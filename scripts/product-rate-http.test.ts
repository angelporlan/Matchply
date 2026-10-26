import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomInt, randomUUID } from 'node:crypto';

const database = process.env.PRODUCT_RATE_TEST_DATABASE_URL, baseUrl = process.env.PRODUCT_RATE_TEST_APP_URL;
test('IP and session limits apply before AI and upload bodies for guests and accounts', { skip: !database || !baseUrl }, async () => {
  assert.ok([database!,baseUrl!].every(url => ['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database;
  const { db, pool } = await import('@/db'); const { users } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm'); const { default: bcrypt } = await import('bcryptjs');
  const userIds: string[] = [], registeredId = randomUUID(), password = randomUUID();
  const subnet = randomInt(1, 250), ip = (last: number) => `198.18.${subnet}.${last}`;
  function client() {
    const cookies = new Map<string,string>();
    return { cookies, send: async (path:string, init:RequestInit = {}) => {
      const headers = new Headers(init.headers); headers.set('Cookie', Array.from(cookies).map(([k,v]) => `${k}=${v}`).join('; '));
      const response = await fetch(new URL(path,baseUrl),{...init,headers,redirect:'manual'});
      for(const cookie of response.headers.getSetCookie()) { const [key,...value] = cookie.split(';')[0].split('='); cookies.set(key,value.join('=')); }
      return response;
    } };
  }
  const headers = (address:string, extra:Record<string,string> = {}) => ({ 'X-Real-IP':address, 'X-Forwarded-For':`${ip(randomInt(80,160))}, ${address}`, ...extra });
  const guest = async (address:string) => {
    const c = client(); const response = await c.send('/api/guest?redirect=/try',{headers:headers(address)}); assert.equal(response.status,307);
    const token = c.cookies.get('matchply_guest'); assert.ok(token);
    const [user] = await db.select({id:users.id}).from(users).where(eq(users.guestTokenHash,createHash('sha256').update(token).digest('hex'))).limit(1);
    assert.ok(user); userIds.push(user.id); return c;
  };
  try {
    // A single IP cannot bypass the upload cap by creating new guest sessions.
    const guests = []; for(let i=0;i<6;i++) guests.push(await guest(ip(10+i)));
    const shared = ip(30);
    for(let i=0;i<60;i++) {
      const response = await guests[i%guests.length].send('/api/cv/parse-pdf',{method:'POST',headers:headers(shared),body:new FormData()});
      assert.equal(response.status,400,`guest upload ${i+1}`);
    }
    const blocked = await guests[0].send('/api/cv/parse-pdf',{method:'POST',headers:headers(shared),body:new FormData()});
    assert.equal(blocked.status,429); assert.equal((await blocked.json()).code,'RATE_LIMITED'); assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal((await guests[0].send('/api/cv/parse-pdf',{method:'POST',headers:headers(ip(31)),body:new FormData()})).status,400);

    // Rotating IPs cannot bypass the actor limit for a guest.
    const oneGuest = await guest(ip(32));
    for(let i=0;i<12;i++) assert.equal((await oneGuest.send('/api/cv/parse-pdf',{method:'POST',headers:headers(ip(40+i)),body:new FormData()})).status,400);
    const guestLimited = await oneGuest.send('/api/cv/parse-pdf',{method:'POST',headers:headers(ip(52)),body:new FormData()});
    assert.equal(guestLimited.status,429); assert.equal((await guestLimited.json()).code,'RATE_LIMITED'); assert.ok(Number(guestLimited.headers.get('retry-after')) > 0);

    // The same session rule applies to a signed-in account before an AI call.
    const email = `product-rate-${registeredId}@example.test`; userIds.push(registeredId);
    await db.insert(users).values({id:registeredId,email,passwordHash:bcrypt.hashSync(password,4)});
    const account = client(), csrf = await (await account.send('/api/auth/csrf')).json();
    await account.send('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email,password,callbackUrl:`${baseUrl}/dashboard`})});
    assert.equal((await (await account.send('/api/auth/session')).json()).user.id,registeredId);
    for(let i=0;i<8;i++) {
      const response = await account.send('/api/ai/profile/extract',{method:'POST',headers:headers(ip(60+i),{'Content-Type':'application/json'}),body:'{}'});
      assert.equal(response.status,400);
    }
    const accountLimited = await account.send('/api/ai/profile/extract',{method:'POST',headers:headers(ip(68),{'Content-Type':'application/json'}),body:'{}'});
    assert.equal(accountLimited.status,429); assert.equal((await accountLimited.json()).code,'RATE_LIMITED'); assert.ok(Number(accountLimited.headers.get('retry-after')) > 0);

    // Rotating the caller-provided first forwarded value cannot bypass the IP guard,
    // and the optimize/variant/retry endpoints share one budget before authentication.
    const anonymous = client(), fixedIp = ip(70), id = randomUUID();
    const paths = ['/api/ai/optimize', `/api/ai/optimize/${id}/generate`, `/api/ai/optimize/${id}/retry`];
    for(let i=0;i<40;i++) {
      const response = await anonymous.send(paths[i%paths.length],{method:'POST',headers:headers(fixedIp,{'Content-Type':'application/json'}),body:'{}'});
      assert.equal(response.status,401,`anonymous optimization ${i+1}`);
    }
    const ipLimited = await anonymous.send(paths[0],{method:'POST',headers:headers(fixedIp,{'Content-Type':'application/json'}),body:'{}'});
    assert.equal(ipLimited.status,429); assert.equal((await ipLimited.json()).code,'RATE_LIMITED');
    assert.equal((await anonymous.send(paths[0],{method:'POST',headers:headers(ip(71),{'Content-Type':'application/json'}),body:'{}'})).status,401);
  } finally { if(userIds.length) await db.delete(users).where(inArray(users.id,userIds)); await pool.end(); }
});
