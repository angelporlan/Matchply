import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
// Kept separate from the unit test so fixture import cannot execute a second test file.
const cv = '# Ana Pérez\n\n**Email:** ana@example.test\n\n## Perfil Profesional\nDesarrollo APIs con Python.\n\n## Experiencia Profesional\n### Desarrolladora\n**Acme** | *2022 – Presente*\n- Desarrollo APIs con Python.\n\n## Habilidades\n- **Backend:** Python\n';
const analysis = { rol_objetivo: 'Backend', idioma_oferta: 'es', top5: ['Python'], keywords: [{ termino: 'Python', tipo: 'imprescindible', evidencia: 'fuerte', cita_cv: 'Desarrollo APIs con Python', sinonimos_reales: [] }], gaps: [], titular_sugerido: 'Desarrolladora', contenido_a_priorizar: [], sugerencias_metricas: [] };
const testUrl = process.env.CV_OPTIMIZATION_TEST_DATABASE_URL;
test('three variants preserve quota, ownership, revisions, sources and partial retry recovery', { skip: !testUrl }, async t => {
  const url = new URL(testUrl!); assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db'); const schema = await import('@/db/schema');
  const { users, cvs, cvVariants, cvOptimizations, aiJobs, jobOffers } = schema;
  const { eq, and, inArray } = await import('drizzle-orm');
  const service = await import('@/lib/cv-optimization/service'); const queue = await import('@/lib/ai-jobs/queue');
  const usage = await import('@/lib/usage'); const { CvOptimizationError } = await import('@/lib/cv-optimization/validation');
  const ids: string[] = [];
  const user = async () => { const id = randomUUID(); ids.push(id); await db.insert(users).values({ id, email: `variants-${id}@example.test` }); const [source] = await db.insert(cvs).values({ userId: id, title: 'Base', content: cv, isBase: true }).returning(); return { id, source }; };
  const input = (id: string) => ({ baseCvId: id, requestId: randomUUID(), jobTitle: 'Backend', company: 'Hiring Co', jobDescription: 'Python APIs', url: null, platform: 'other', addToApplications: true });
  const call = async (_ref: unknown, _system: string, _user: string, _temp: number, _signal: AbortSignal, mode: string, _plan: string) => mode.startsWith('analysis') ? JSON.stringify(analysis) : cv;
  try {
    await t.test('one admission, three variants, one quota unit and one application; revisions isolate saves', async () => {
      const u = await user(); const params = input(u.source.id);
      const [a,b] = await Promise.all([service.enqueueCvOptimization(u.id,params), service.enqueueCvOptimization(u.id,params)]); assert.deepEqual(a,b);
      await assert.rejects(service.enqueueCvOptimization(u.id,{ ...params, company: 'Other' }), /otra optimización/);
      const job = await queue.claimAiJobById(a.jobId); assert.ok(job);
      const result = await service.processCvOptimization(job, new AbortController().signal, call);
      const view = await service.getCvOptimizationView(u.id,a.cvId); assert.ok(view); assert.equal(view.variants.filter(v => v.status === 'ready').length,3);
      assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.used,1);
      const [saved] = await db.select().from(cvs).where(eq(cvs.id,a.cvId)); assert.equal(saved.activeOptimizeMode,'optimize_adapted');
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.cvId,a.cvId))).length,1);
      const stranger = await user(); assert.equal(await service.getCvOptimizationView(stranger.id,a.cvId),null);
      await assert.rejects(service.activateCvVariant(stranger.id,a.cvId,view.id,'optimize_honest'));
      await service.saveCvVariant(u.id,a.cvId,cv+'\nTexto propio.',{ optimizationId:view.id,modeId:'optimize_adapted',revision:0 });
      await assert.rejects(service.saveCvVariant(u.id,a.cvId,'Stale',{ optimizationId:view.id,modeId:'optimize_adapted',revision:0 }),/otra ventana/);
      await service.activateCvVariant(u.id,a.cvId,view.id,'optimize_honest');
      await service.saveCvVariant(u.id,a.cvId,cv+'\nEdición tardía.',{ optimizationId:view.id,modeId:'optimize_adapted',revision:1 });
      const [active] = await db.select().from(cvs).where(eq(cvs.id,a.cvId)); assert.equal(active.content,cv);
      await db.update(cvs).set({ content:'# Base cambiado' }).where(eq(cvs.id,u.source.id));
      assert.equal((await service.getCvOptimizationView(u.id,a.cvId))?.sourceMarkdown,cv);
      assert.equal(result.cvId,a.cvId);
    });
    await t.test('partial success retries only failed modes without another reservation or overwriting edits', async () => {
      const u = await user(); const created = await service.enqueueCvOptimization(u.id,input(u.source.id)); const job = await queue.claimAiJobById(created.jobId); assert.ok(job);
      await service.processCvOptimization(job,new AbortController().signal,async (...args) => { if (args[5].startsWith('optimize_aggressive')) throw new CvOptimizationError('INVALID_CV_VARIANT'); return call(...args); });
      const view = (await service.getCvOptimizationView(u.id,created.cvId))!; assert.equal(view.variants.filter(v => v.status === 'ready').length,2);
      await service.saveCvVariant(u.id,created.cvId,cv+'\nMi edición.',{ optimizationId:view.id,modeId:'optimize_adapted',revision:0 });
      const requestId = randomUUID(); const retry = await service.retryCvOptimization(u.id,view.id,['optimize_aggressive'],requestId);
      assert.deepEqual(await service.retryCvOptimization(u.id,view.id,['optimize_aggressive'],requestId),retry);
      const owner = await queue.claimAiJobById(retry.jobId); assert.ok(owner); const modes:string[]=[];
      await service.processCvOptimization(owner,new AbortController().signal,async (...args) => { modes.push(args[5]); return call(...args); });
      assert.deepEqual(modes,['optimize_aggressive']); assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.used,1);
      assert.equal((await service.getCvOptimizationView(u.id,created.cvId))?.variants.find(v => v.modeId==='optimize_adapted')?.content,cv+'\nMi edición.');
      await assert.rejects(service.retryCvOptimization(u.id,view.id,['optimize_adapted'],randomUUID()),/modos fallidos/);
    });
    await t.test('expired attempts cannot publish and terminal failure preserves replacement and returns quota', async () => {
      const u = await user(); const [target] = await db.insert(cvs).values({ userId:u.id,title:'Existing',content:'Previous',isBase:false }).returning();
      const created = await service.enqueueCvOptimization(u.id,{ ...input(u.source.id),targetCvId:target.id,confirmOverwrite:true }); const old = await queue.claimAiJobById(created.jobId); assert.ok(old);
      await db.update(aiJobs).set({ leaseUntil:new Date(0) }).where(eq(aiJobs.id,old.id));
      await assert.rejects(service.processCvOptimization(old,new AbortController().signal,call),/LEASE_LOST/);
      const current = await queue.claimAiJobById(old.id); assert.ok(current);
      await queue.failAiJob(current,new CvOptimizationError('AI_NOT_CONFIGURED'));
      const [kept] = await db.select().from(cvs).where(eq(cvs.id,target.id)); assert.equal(kept.content,'Previous'); assert.equal(kept.pendingUsageOperationId,null);
      assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.used,0); assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.reserved,0);
      await assert.rejects(service.enqueueCvOptimization(u.id,{ ...input(u.source.id),targetCvId:u.source.id,confirmOverwrite:true }),/CV base/);
    });
    await t.test('transient errors reuse analysis and completed modes on the next attempt', async () => {
      const u = await user(); const c = await service.enqueueCvOptimization(u.id,input(u.source.id)); const j = await queue.claimAiJobById(c.jobId); assert.ok(j);
      const error = new CvOptimizationError('AI_HTTP_503',true);
      await assert.rejects(service.processCvOptimization(j,new AbortController().signal,async (...args) => { if (args[5]==='optimize_aggressive') throw error; return call(...args); }),/AI_HTTP_503/);
      await queue.failAiJob(j,error); await db.update(aiJobs).set({ nextAttemptAt:new Date(0) }).where(eq(aiJobs.id,j.id));
      const next = await queue.claimAiJobById(j.id); assert.ok(next); const calls:string[]=[];
      await service.processCvOptimization(next,new AbortController().signal,async (...args) => { calls.push(args[5]); return call(...args); });
      assert.deepEqual(calls,['optimize_aggressive']); assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.used,1);
    });
    await t.test('an in-flight guest job survives account claim and is owned by the account', async () => {
      const guest = await user(); const account = await user(); await db.update(users).set({ isGuest:true }).where(eq(users.id,guest.id));
      const c = await service.enqueueCvOptimization(guest.id,input(guest.source.id)); const j = await queue.claimAiJobById(c.jobId); assert.ok(j);
      await db.transaction(async tx => {
        await usage.transferGuestUsage(tx,guest.id,account.id);
        await tx.update(cvs).set({ userId:account.id }).where(eq(cvs.userId,guest.id));
        await tx.update(cvOptimizations).set({ userId:account.id }).where(eq(cvOptimizations.userId,guest.id));
        await tx.update(aiJobs).set({ userId:account.id }).where(eq(aiJobs.userId,guest.id));
        await tx.delete(users).where(eq(users.id,guest.id));
      });
      await service.processCvOptimization(j,new AbortController().signal,call);
      assert.ok(await service.getCvOptimizationView(account.id,c.cvId)); assert.equal(await service.getCvOptimizationView(guest.id,c.cvId),null);
      assert.equal((await usage.getUsageSnapshot(account.id)).usage.general.used,1);
    });
    await t.test('free read-only CVs cannot select or save variants, and Pro restores access', async () => {
      const u = await user(); await db.update(users).set({ subscriptionStatus:'active' }).where(eq(users.id,u.id));
      const c = await service.enqueueCvOptimization(u.id,input(u.source.id)); const j = await queue.claimAiJobById(c.jobId); assert.ok(j); await service.processCvOptimization(j,new AbortController().signal,call);
      const view = (await service.getCvOptimizationView(u.id,c.cvId))!;
      await db.insert(cvs).values([1,2].map(n=>({ userId:u.id,title:'Recent',content:cv,isBase:false }))); await db.update(users).set({ subscriptionStatus:'none' }).where(eq(users.id,u.id));
      const { selectActiveCvs } = await import('@/lib/cv-access'); const rows = await db.select({id:cvs.id}).from(cvs).where(and(eq(cvs.userId,u.id),eq(cvs.title,'Recent')));
      await selectActiveCvs(u.id,u.source.id,rows.map(r=>r.id));
      await assert.rejects(service.activateCvVariant(u.id,c.cvId,view.id,'optimize_honest'),/read-only/);
      await assert.rejects(service.saveCvVariant(u.id,c.cvId,cv,{optimizationId:view.id,modeId:'optimize_adapted',revision:0}),/read-only/);
      await db.update(users).set({ subscriptionStatus:'active' }).where(eq(users.id,u.id)); assert.ok(await service.activateCvVariant(u.id,c.cvId,view.id,'optimize_honest'));
    });
    await t.test('last expired worker publishes checkpointed successes rather than losing them', async () => {
      const u = await user(); const c = await service.enqueueCvOptimization(u.id,input(u.source.id)); const j=await queue.claimAiJobById(c.jobId); assert.ok(j);
      const runId=(j.payload as { optimizationId:string }).optimizationId;
      await db.update(cvVariants).set({ status:'ready',content:cv }).where(and(eq(cvVariants.optimizationId,runId),eq(cvVariants.modeId,'optimize_honest')));
      await db.update(aiJobs).set({ attempt:3,leaseUntil:new Date(0) }).where(eq(aiJobs.id,j.id));
      await queue.claimNextAiJob();
      assert.equal((await queue.getAiJob(j.id))?.status,'completed'); assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.used,1);
      assert.equal((await service.getCvOptimizationView(u.id,c.cvId))?.variants.find(v => v.modeId==='optimize_honest')?.status,'ready');
    });
    await t.test('offer optimization links its existing application only on publication; double admission is atomic', async () => {
      const u=await user(); const [offer]=await db.insert(jobOffers).values({userId:u.id,title:'Backend',company:'Hiring Co',description:'Python APIs',platform:'other'}).returning();
      const params={...input(u.source.id),jobOfferId:offer.id,addToApplications:false};
      const [a,b]=await Promise.all([service.enqueueCvOptimization(u.id,params),service.enqueueCvOptimization(u.id,params)]); assert.deepEqual(a,b);
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.id,offer.id)))[0].cvId,null);
      const j=await queue.claimAiJobById(a.jobId); assert.ok(j); await service.processCvOptimization(j,new AbortController().signal,call);
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.id,offer.id)))[0].cvId,a.cvId);
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.userId,u.id))).length,1);
      const other=await user(); await assert.rejects(service.enqueueCvOptimization(other.id,{...input(other.source.id),jobOfferId:offer.id}),/candidatura/);
    });
    await t.test('deleting the linked application before publication preserves the destination and releases quota', async () => {
      const u=await user();
      const [target]=await db.insert(cvs).values({userId:u.id,title:'Preserved',content:'Previous document',isBase:false}).returning();
      const [offer]=await db.insert(jobOffers).values({userId:u.id,cvId:target.id,title:'Backend',company:'Hiring Co',description:'Python APIs',platform:'other'}).returning();
      const c=await service.enqueueCvOptimization(u.id,{...input(u.source.id),targetCvId:target.id,confirmOverwrite:true,jobOfferId:offer.id,addToApplications:false});
      const j=await queue.claimAiJobById(c.jobId); assert.ok(j);
      const runId=(j.payload as {optimizationId:string}).optimizationId;
      await db.update(cvOptimizations).set({analysis}).where(eq(cvOptimizations.id,runId));
      await db.update(cvVariants).set({status:'ready',content:cv}).where(eq(cvVariants.optimizationId,runId));
      await db.delete(jobOffers).where(eq(jobOffers.id,offer.id));
      const failure=new CvOptimizationError('OFFER_NOT_FOUND');
      await assert.rejects(service.processCvOptimization(j,new AbortController().signal,call),/OFFER_NOT_FOUND/);
      await queue.failAiJob(j,failure);
      const [kept]=await db.select().from(cvs).where(eq(cvs.id,target.id));
      assert.equal(kept.content,'Previous document'); assert.equal(kept.optimizationId,null); assert.equal(kept.pendingUsageOperationId,null);
      const snapshot=await usage.getUsageSnapshot(u.id); assert.equal(snapshot.usage.general.used,0); assert.equal(snapshot.usage.general.reserved,0);
    });
    await t.test('one repair per invalid output and no more than three simultaneous generation calls', async () => {
      const u=await user(); const c=await service.enqueueCvOptimization(u.id,input(u.source.id)); const j=await queue.claimAiJobById(c.jobId); assert.ok(j);
      const calls:string[]=[]; let active=0, peak=0, entered=0; let unblock!:()=>void; const barrier=new Promise<void>(resolve=>{unblock=resolve;});
      await service.processCvOptimization(j,new AbortController().signal,async (...args)=>{
        const mode=args[5]; calls.push(mode);
        if (mode==='analysis') return 'Private contact malformed JSON';
        if (mode==='analysis-repair') return JSON.stringify(analysis);
        active++; peak=Math.max(peak,active);
        try {
          if (!mode.endsWith(':repair')) { if (++entered===3) unblock(); await barrier; }
          return mode==='optimize_honest' ? cv+'\nInvented metric 88%' : cv;
        } finally { active--; }
      });
      assert.equal(peak,3); assert.equal(calls.filter(m=>m==='analysis').length,1); assert.equal(calls.filter(m=>m==='analysis-repair').length,1);
      assert.equal(calls.filter(m=>m.endsWith(':repair')).length,1); assert.ok(calls.includes('optimize_honest:repair'));
      assert.equal((await service.getCvOptimizationView(u.id,c.cvId))?.variants.filter(v=>v.status==='ready').length,3);
      assert.equal((await usage.getUsageSnapshot(u.id)).usage.general.used,1);
    });
  } finally { await db.delete(users).where(inArray(users.id,ids)); await pool.end(); }
});
