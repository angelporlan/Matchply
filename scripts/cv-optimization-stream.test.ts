import test from 'node:test';
import assert from 'node:assert/strict';
import { readCvAiStream } from '@/lib/cv-optimization/stream';

function stream(text:string) {
  const bytes=new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({start(controller){for(let i=0;i<bytes.length;i+=3) controller.enqueue(bytes.slice(i,i+3));controller.close();}});
}
const event=(value:unknown)=>`data: ${JSON.stringify(value)}\r\n\r\n`;
test('streamed chat deltas preserve UTF-8 boundaries, incremental content and final usage',async()=>{
  const partial:string[]=[];
  const body=stream(': keepalive\r\n\r\n'+event({choices:[{delta:{content:'# Ana Pérez\n'},finish_reason:null}]})+event({choices:[{delta:{content:'Desarrolladora'},finish_reason:'stop'}]})+event({choices:[],usage:{prompt_tokens:31,completion_tokens:12}})+'data: [DONE]\r\n\r\n');
  const result=await readCvAiStream(body,'openai',async content=>{partial.push(content);});
  assert.deepEqual(partial,['# Ana Pérez\n','# Ana Pérez\nDesarrolladora']);
  assert.equal(result.content,partial[1]); assert.equal(result.inputTokens,31); assert.equal(result.outputTokens,12);
});
test('Gemini streams ignore thought parts and require a complete finish',async()=>{
  const partial:string[]=[];
  const body=stream(event({candidates:[{content:{parts:[{text:'Private reasoning',thought:true},{text:'# CV'}]}}]})+event({candidates:[{content:{parts:[{text:'\nReal content'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:8}}));
  const result=await readCvAiStream(body,'gemini',async content=>{partial.push(content);});
  assert.equal(result.content,'# CV\nReal content'); assert.equal(result.outputTokens,8); assert.doesNotMatch(partial.join(''),/reasoning/);
});
test('truncated, malformed and length-limited streams never pass as complete CVs',async()=>{
  await assert.rejects(readCvAiStream(stream(event({choices:[{delta:{content:'Partial'}}]})),'openai',async()=>{}),{message:'AI_INCOMPLETE_RESPONSE'});
  await assert.rejects(readCvAiStream(stream('data: Private candidate malformed JSON\n\n'),'openai',async()=>{}),{message:'AI_INVALID_STREAM'});
  await assert.rejects(readCvAiStream(stream(event({choices:[{delta:{content:'Partial'},finish_reason:'length'}]})),'deepseek',async()=>{}),{message:'AI_INCOMPLETE_RESPONSE'});
});
test('a rejected preview checkpoint aborts stream consumption and cannot publish later deltas',async()=>{
  let calls=0;
  await assert.rejects(readCvAiStream(stream(event({choices:[{delta:{content:'# CV'}}]})+event({choices:[{delta:{content:'More'},finish_reason:'stop'}]})),'openrouter',async()=>{calls++;throw new Error('OPTIMIZATION_LEASE_LOST');}),/LEASE_LOST/);
  assert.equal(calls,1);
});
