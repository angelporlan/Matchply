/** Read the text protocol without exposing footer markers or accepting an incomplete result. */
export async function consumeCvAiStream(response: Response, onContent?: (content: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('EMPTY_AI_STREAM');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const marker = buffer.search(/\[(?:METADATA|ERROR):/);
    // Withhold a short suffix so a marker split between chunks never enters the document.
    onContent?.(marker >= 0 ? buffer.slice(0, marker).trimEnd() : buffer.slice(0, done ? undefined : Math.max(0, buffer.length - 12)));
    if (done) break;
  }
  const failure = buffer.indexOf('[ERROR:');
  if (failure >= 0) throw new Error(buffer.slice(failure + 7).replace(/\]\s*$/, '').trim());
  const marker = buffer.lastIndexOf('[METADATA:');
  if (marker < 0) throw new Error('INCOMPLETE_AI_STREAM');
  const metadata = JSON.parse(buffer.slice(marker + 10).replace(/\]\s*$/, '')) as { success?: boolean; cvId?: string };
  if (!metadata.success || typeof metadata.cvId !== 'string') throw new Error('INCOMPLETE_AI_STREAM');
  return { cvId: metadata.cvId, content: buffer.slice(0, marker).trimEnd() };
}
