import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const database = process.env.PROBLEM_REPORTS_HTTP_TEST_DATABASE_URL, baseUrl = process.env.PROBLEM_REPORTS_HTTP_TEST_APP_URL;
test('explicit reports enforce origin, bounds, rate limits, durable retries and administrator-only access', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!,baseUrl!].every(url => ['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db'); const { users, problemReports } = await import('@/db/schema'); const { eq, inArray } = await import('drizzle-orm'); const { default: bcrypt } = await import('bcryptjs');
  const ids = [randomUUID(),randomUUID()], reportIds = [randomUUID(),randomUUID(),randomUUID()], requestId = randomUUID(), password = randomUUID();
  function client() {
    const cookies = new Map<string,string>();
    return async (path:string, init:RequestInit = {}) => {
      const headers = new Headers(init.headers); headers.set('Cookie', Array.from(cookies).map(([k,v]) => `${k}=${v}`).join('; '));
      const response = await fetch(new URL(path,baseUrl),{ ...init,headers,redirect:'manual' });
      for (const cookie of response.headers.getSetCookie()) { const [key,...value] = cookie.split(';')[0].split('='); cookies.set(key,value.join('=')); } return response;
    };
  }
  const options = (body:unknown, ip = randomUUID()):RequestInit => ({method:'POST',headers:{Origin:new URL(baseUrl!).origin,'Content-Type':'application/json','X-Real-IP':ip},body:JSON.stringify(body)});
  try {
    const anonymous = client(), report = { id:reportIds[0],requestId,step:'optimization',route:'/editor/private-cv?token=secret',comment:'Explicit private comment canary <img src=x onerror=alert(1)>' };
    assert.equal((await anonymous('/api/diagnostics/reports',{...options(report),headers:{Origin:'https://foreign.test','Content-Type':'application/json'}})).status,403);
    assert.equal((await anonymous('/api/diagnostics/reports',{...options(report),headers:{Origin:new URL(baseUrl!).origin,'Content-Type':'text/plain'}})).status,415);
    assert.equal((await anonymous('/api/diagnostics/reports',options({...report,comment:'a'.repeat(11000)}))).status,413);
    assert.equal((await anonymous('/api/diagnostics/reports',options({...report,comment:'a'.repeat(2001)}))).status,400);
    assert.equal((await anonymous('/api/diagnostics/reports',options({...report,rawCv:'private'}))).status,400);
    for(let i=0;i<2;i++) { const response = await anonymous('/api/diagnostics/reports',options(report)); assert.equal(response.status,201); assert.deepEqual(await response.json(),{accepted:true,id:reportIds[0]}); }
    const rows = await db.select().from(problemReports).where(eq(problemReports.id,reportIds[0])); assert.equal(rows.length,1); assert.equal(rows[0].comment,report.comment); assert.equal(rows[0].route,'/editor/:cvId');
    assert.equal((await anonymous('/api/diagnostics/reports',options({...report,comment:'Conflicting retry'}))).status,409);
    assert.equal((await anonymous('/api/diagnostics/reports',options({ ...report,id:reportIds[1],requestId:null,comment:'' }))).status,201);
    const rateIp = randomUUID();
    for(let i=0;i<5;i++) assert.equal((await anonymous('/api/diagnostics/reports',options({...report,id:reportIds[2]},rateIp))).status,201);
    const limited = await anonymous('/api/diagnostics/reports',options({...report,id:reportIds[2]},rateIp)); assert.equal(limited.status,429); assert.equal(limited.headers.get('Retry-After'),'600');
    await db.insert(users).values(ids.map((id,index)=>({id,email:`reports-${id}@example.test`,passwordHash:bcrypt.hashSync(password,4),role:index===0?'admin':'user'})));
    for(let index=0;index<ids.length;index++) {
      const request = client(), csrf = await (await request('/api/auth/csrf')).json();
      await request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:`reports-${ids[index]}@example.test`,password,callbackUrl:`${baseUrl}/dashboard`})});
      assert.equal((await(await request('/api/auth/session')).json()).user.id,ids[index]);
      const response = await request(`/admin/reports?requestId=${requestId}`), html = await response.text();
      if(index===0) { assert.equal(response.status,200); assert.match(html,/Avisos de usuarios/); assert.match(html,/Explicit private comment canary/); assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/); }
      else assert.doesNotMatch(html,/Explicit private comment canary/);
    }
    assert.doesNotMatch(await(await anonymous('/admin/reports')).text(),/Explicit private comment canary/);
  } finally { await db.delete(problemReports).where(inArray(problemReports.id,reportIds)); await db.delete(users).where(inArray(users.id,ids)); await pool.end(); }
});
