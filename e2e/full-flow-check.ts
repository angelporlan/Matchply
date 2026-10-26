import { test, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const cv = '# Ana Pérez\n\n**Email:** ana@example.test\n\n## Perfil Profesional\nDesarrollo APIs con Python.\n\n## Experiencia Profesional\n### Desarrolladora\n**Acme** | *2022 – Presente*\n- Desarrollo APIs con Python.\n\n## Habilidades\n- **Backend:** Python\n';
const analysis = { rol_objetivo:'Backend', idioma_oferta:'es', top5:['Python'], keywords:[{termino:'Python',tipo:'imprescindible',evidencia:'fuerte',cita_cv:'Desarrollo APIs con Python',sinonimos_reales:[]}], gaps:[],titular_sugerido:'Desarrolladora',contenido_a_priorizar:[],sugerencias_metricas:[] };
const first='Buscamos una desarrolladora Python para crear APIs con pruebas automatizadas y bases de datos SQL. Trabajo en equipo y experiencia demostrable.';
const second='Buscamos una ingeniera Python para mantener APIs, mejorar calidad del software y colaborar con equipos multidisciplinares.';
const testDb=process.env.INTEGRATION_TEST_DATABASE_URL!;
if (!testDb || !['localhost','127.0.0.1','[::1]'].includes(new URL(testDb).hostname) || !new URL(testDb).pathname.includes('test')) throw new Error('Isolated database required');
process.env.DATABASE_URL=testDb;
let sharedPool: {end:()=>Promise<void>} | undefined;
test.afterAll(async()=>{ if(sharedPool) await sharedPool.end(); });
for(const guest of [true,false]) for(const width of [390,1440]) for(const blocked of [true,false]) test(`real workflow ${guest?'guest':'account'} ${width} ${blocked?'blocked':'pasted'}`, async({page,context,baseURL})=>{
 const client=new pg.Client({connectionString:testDb}); await client.connect();
 const {pool}=await import('@/db'); sharedPool=pool; const queue=await import('@/lib/ai-jobs/queue'); const service=await import('@/lib/cv-optimization/service');
 let userId:string|undefined; const guestHashes:string[]=[]; const email=`e2e-${randomUUID()}@example.test`,password=randomUUID();
 const jobs:string[]=[], errors:string[]=[]; const executions:Promise<void>[]=[];
 page.on('response', response=>{if(response.request().method()==='POST'&&response.url().endsWith('/api/ai/optimize')&&response.status()===202){
  const task=(async()=>{const {jobId}=await response.json();jobs.push(jobId);const job=await queue.claimAiJobById(jobId);if(!job)throw new Error('Could not claim synthetic job');
   await service.processCvOptimization(job,new AbortController().signal,async(_ref,_system,_user,_temp,_signal,mode)=>mode.startsWith('analysis')?JSON.stringify(analysis):cv);
  })().catch(error=>{errors.push(String(error));});executions.push(task);
 }});
 try {
  if(!guest){userId=randomUUID();await client.query('insert into "user" (id,email,"passwordHash") values ($1,$2,$3)',[userId,email,bcrypt.hashSync(password,4)]);const csrf=await(await context.request.get('/api/auth/csrf')).json();await context.request.post('/api/auth/callback/credentials',{form:{csrfToken:csrf.csrfToken,email,password,callbackUrl:`${baseURL}/try`}});expect((await(await context.request.get('/api/auth/session')).json()).user.id).toBe(userId);}
  await page.route('**/__analytics-test.js',route=>route.fulfill({contentType:'application/javascript',body:'/* synthetic analytics */'}));
  if(blocked){await page.route('**/api/ai/offers/import',r=>r.fulfill({status:202,json:{jobId:'synthetic-block'}}));await page.route('**/api/ai/jobs/synthetic-block',r=>r.fulfill({json:{status:'failed',result:null,lastError:'No se pudo completar la acción con IA.',errorCode:'OFFER_PORTAL_BLOCKED'}}));}
  await page.setViewportSize({width,height:844});await page.goto('/try');
  await page.getByRole('button',{name:'¿No tienes PDF? Pega el texto',exact:true}).click();await page.getByRole('textbox',{name:'Tu CV',exact:true}).fill(cv);
  await page.getByRole('button',{name:'Continuar al paso 2 (añadir oferta)',exact:true}).click();
  await page.getByRole('button',{name:'Pegar descripción manualmente',exact:true}).click();const field=page.getByRole('textbox',{name:'Descripción y requisitos',exact:true});await field.fill(first);
  if(blocked){await page.getByRole('textbox',{name:'Enlace a la oferta',exact:true}).fill('https://jobs.hiringroom.com/jobs/example');await page.getByRole('button',{name:'Importar oferta',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'No hemos podido leer este enlace.'})).toBeVisible();await expect(field).toHaveValue(first);}
  await page.getByRole('button',{name:'Adaptar mi CV',exact:true}).click();
  await expect.poll(()=>jobs.length,{timeout:20000}).toBe(1);await Promise.all(executions);expect(errors).toEqual([]);
  await expect(page).toHaveURL(/\/editor\//);const repeat=page.getByRole('button',{name:'Adaptar a otra oferta',exact:true});await expect(repeat).toBeEnabled({timeout:30000});await repeat.click();
  const dialog=page.getByRole('dialog',{name:'Adaptar a otra oferta',exact:true});await dialog.getByRole('button',{name:'Pegar descripción manualmente',exact:true}).click();await dialog.getByRole('textbox',{name:'Descripción y requisitos',exact:true}).fill(second);await dialog.getByRole('button',{name:'Adaptar a esta oferta',exact:true}).click();
  await expect.poll(()=>jobs.length,{timeout:20000}).toBe(2);await Promise.all(executions);expect(errors).toEqual([]);
  const rows=await client.query('select payload from ai_job where id = any($1::uuid[])',[jobs]);expect(rows.rowCount).toBe(2);
  const optimizations=await client.query('select "sourceCvId",offer from cv_optimization where "operationId" in (select "usageOperationId" from ai_job where id = any($1::uuid[]))',[jobs]);expect(optimizations.rowCount).toBe(2);expect(optimizations.rows[0].sourceCvId).toBeTruthy();expect(optimizations.rows[0].sourceCvId).toBe(optimizations.rows[1].sourceCvId);expect(optimizations.rows.map(row => row.offer.jobDescription).sort()).toEqual([first, second].sort());
  if(guest){const c=(await context.cookies(baseURL)).find(c=>c.name==='matchply_guest');expect(c).toBeTruthy();guestHashes.push(createHash('sha256').update(c!.value).digest('hex'));const rows=await client.query('select id from "user" where "guestTokenHash"=$1',[guestHashes[0]]);userId=rows.rows[0]?.id;}
 } finally {await Promise.all(executions);if(!userId&&guest){const c=(await context.cookies(baseURL)).find(c=>c.name==='matchply_guest');if(c){const r=await client.query('select id from "user" where "guestTokenHash"=$1',[createHash('sha256').update(c.value).digest('hex')]);userId=r.rows[0]?.id;}}if(userId)await client.query('delete from "user" where id=$1',[userId]);await client.end();}
});
