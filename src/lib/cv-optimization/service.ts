import { randomUUID } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { aiJobs, cvs, cvOptimizations, cvVariants, jobOffers, users, usageOperations, type AiJob } from '@/db/schema';
import { lockCvUser, requireEditableCv, reserveCvTarget } from '@/lib/cv-access';
import { reserveUsage, consumeUsage, releaseUsage, usageInputHash, UsageError } from '@/lib/usage';
import { getResolvedAiRuntime } from '@/lib/ai-runtime-store';
import { parseAiRuntimeConfig, resolveModelForFunction } from '@/lib/ai-runtime-config';
import { effectiveSubscriptionStatus, getAllowedCvTemplate, canAccessFeature, userEntitlements } from '@/lib/subscription';
import { OPTIMIZE_MODE_IDS, isOptimizeModeId, type OptimizeModeId } from '@/lib/optimize-modes';
import { findOrCreateCompany } from '@/lib/company-service';
import { recordFirstValue } from '@/lib/monetization';
import { createAuditLog } from '@/lib/audit';
import { log } from '@/lib/logger';
import type { PlanDb } from '@/lib/plan-store';
import { ANALYSIS_PROMPT, CV_OPTIMIZATION_PROMPT_VERSION, analysisUserPrompt, generationPrompts } from './prompts';
import { callCvAi } from './provider';
import { CvOptimizationError, factualProfile, parseAnalysisResponse, validateAnalysis, validateVariant } from './validation';
import type { CvAnalysis, CvOptimizationView, CvVariant, OptimizeJobPayload, OptimizeOffer, OptimizeProgress, VariantSaveContext } from './types';

type Admission = OptimizeOffer & { baseCvId: string; targetCvId?: string; confirmOverwrite?: boolean; requestId: string };
const jobPayload = (job: AiJob) => job.payload as OptimizeJobPayload & { inputHash?: string };
const modeFilter = (id: string, mode: string) => and(eq(cvVariants.optimizationId, id), eq(cvVariants.modeId, mode));

export async function enqueueCvOptimization(userId: string, input: Admission) {
  const config = await getResolvedAiRuntime();
  const inputHash = usageInputHash(input);
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const [existing] = await tx.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'optimize_cv_variants'), sql`${aiJobs.payload}->>'requestId' = ${input.requestId}`)).limit(1);
    if (existing) {
      if (existing.status === 'failed') throw new UsageError(409, 'OPERATION_RELEASED', 'La generación falló. Puedes iniciar otro intento.');
      if (jobPayload(existing).inputHash !== inputHash) throw new UsageError(409, 'OPTIMIZE_REQUEST_CONFLICT', 'Esta solicitud ya se utilizó para otra optimización.');
      const [run] = await tx.select({ cvId: cvOptimizations.cvId }).from(cvOptimizations).where(eq(cvOptimizations.id, jobPayload(existing).optimizationId)).limit(1);
      if (!run) throw new UsageError(410, 'RESULT_NOT_FOUND', 'El resultado ya no existe.');
      return { jobId: existing.id, cvId: run.cvId };
    }
    await requireEditableCv(tx, userId, input.baseCvId);
    const [[user], [source]] = await Promise.all([
      tx.select({ subscriptionStatus: users.subscriptionStatus, isGuest: users.isGuest, proGrantedUntil: users.proGrantedUntil, careerProfile: users.careerProfile }).from(users).where(eq(users.id, userId)).limit(1),
      tx.select({ id: cvs.id, content: cvs.content, templateName: cvs.templateName, accentColor: cvs.accentColor, fontFamily: cvs.fontFamily, pageMargin: cvs.pageMargin, scale: cvs.scale, pending: cvs.pendingUsageOperationId }).from(cvs).where(and(eq(cvs.id, input.baseCvId), eq(cvs.userId, userId))).limit(1),
    ]);
    if (!user || !source?.content.trim()) throw new UsageError(400, 'EMPTY_SOURCE_CV', 'El CV de origen está vacío.');
    if (source.pending) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'El CV de origen se está generando.');
    if (input.jobOfferId) {
      const [ownedOffer] = await tx.select({ id: jobOffers.id }).from(jobOffers).where(and(eq(jobOffers.id,input.jobOfferId),eq(jobOffers.userId,userId))).limit(1);
      if (!ownedOffer || !canAccessFeature(user.subscriptionStatus,'applications',userEntitlements(user))) throw new UsageError(404,'OFFER_NOT_FOUND','La candidatura no está disponible.');
    }
    if (input.targetCvId && (await requireEditableCv(tx, userId, input.targetCvId)).isBase) throw new UsageError(403, 'BASE_CV_PROTECTED', 'Elige un CV adaptado como destino para conservar el CV base.');
    const jobId = randomUUID(); const optimizationId = randomUUID();
    const operation = await reserveUsage(tx, userId, { bucket: 'general', requestId: input.requestId, action: 'optimize_cv', input, units: 1, jobId });
    const cvId = await reserveCvTarget(tx, userId, { baseCvId: input.baseCvId, targetCvId: input.targetCvId, confirmOverwrite: input.confirmOverwrite, operationId: operation.id,
      values: { title: `Optimizado - ${input.jobTitle} (${input.company})`, isBase: false, isPrincipal: false,
        templateName: getAllowedCvTemplate(user.subscriptionStatus, source.templateName, userEntitlements(user)), accentColor: source.accentColor, fontFamily: source.fontFamily, pageMargin: source.pageMargin, scale: source.scale } });
    const offer: OptimizeOffer = { jobTitle: input.jobTitle, company: input.company, jobDescription: input.jobDescription, url: input.url, platform: input.platform, jobOfferId: input.jobOfferId,
      addToApplications: input.addToApplications && canAccessFeature(user.subscriptionStatus, 'applications', userEntitlements(user)) };
    await tx.insert(cvOptimizations).values({ id: optimizationId, userId, cvId, sourceCvId: source.id, sourceMarkdown: source.content,
      sourceProfile: factualProfile(user.careerProfile), offer, promptVersion: CV_OPTIMIZATION_PROMPT_VERSION, resolvedAiConfig: config,
      subscriptionStatus: effectiveSubscriptionStatus(user), operationId: operation.id });
    await tx.insert(cvVariants).values(OPTIMIZE_MODE_IDS.map(modeId => ({ optimizationId, modeId })));
    await tx.insert(aiJobs).values({ id: jobId, userId, initiatedByUserId: userId, kind: 'optimize_cv_variants', usageOperationId: operation.id,
      resolvedAiConfig: config, payload: { optimizationId, requestId: input.requestId, modes: [...OPTIMIZE_MODE_IDS], inputHash }, nextAttemptAt: new Date(),
      result: { stage: 'queued', cvId, optimizationId, variants: OPTIMIZE_MODE_IDS.map(modeId => ({ modeId, status: 'pending', error: null })) } });
    return { jobId, cvId };
  });
}

export async function retryCvOptimization(userId: string, optimizationId: string, modes: OptimizeModeId[], requestId: string) {
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const [run] = await tx.select().from(cvOptimizations).where(and(eq(cvOptimizations.id, optimizationId), eq(cvOptimizations.userId, userId))).limit(1);
    if (!run) throw new UsageError(404, 'OPTIMIZATION_NOT_FOUND', 'La optimización ya no existe.');
    const current = await requireEditableCv(tx, userId, run.cvId);
    if (current.pendingUsageOperationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'El CV se está generando.');
    const [cv] = await tx.select({ optimizationId: cvs.optimizationId }).from(cvs).where(eq(cvs.id, run.cvId)).limit(1);
    if (cv.optimizationId !== optimizationId) throw new UsageError(409, 'STALE_OPTIMIZATION', 'Este CV tiene otra optimización activa.');
    const inputHash = usageInputHash({ optimizationId, modes });
    const jobs = await tx.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'optimize_cv_variants'), sql`${aiJobs.payload}->>'optimizationId' = ${optimizationId}`));
    const replay = jobs.find(j => jobPayload(j).requestId === requestId);
    if (replay) {
      if (jobPayload(replay).inputHash !== inputHash) throw new UsageError(409, 'OPTIMIZE_REQUEST_CONFLICT', 'El reintento tiene otros modos.');
      if (replay.status === 'failed') throw new UsageError(409, 'OPERATION_RELEASED', 'El reintento falló. Puedes intentarlo de nuevo.');
      return { jobId: replay.id, cvId: run.cvId };
    }
    if (jobs.some(j => j.status === 'queued' || j.status === 'running')) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'Ya hay un reintento en curso.');
    const variants = await tx.select().from(cvVariants).where(eq(cvVariants.optimizationId, optimizationId));
    if (!modes.length || modes.some(mode => !isOptimizeModeId(mode) || variants.find(v => v.modeId === mode)?.status !== 'error')) throw new UsageError(400, 'INVALID_RETRY_MODES', 'Solo puedes reintentar los modos fallidos.');
    const [operation] = await tx.select({ status: usageOperations.status }).from(usageOperations).where(eq(usageOperations.id, run.operationId)).limit(1);
    if (operation?.status !== 'consumed') throw new UsageError(409, 'OPERATION_RELEASED', 'Esta optimización no tiene resultados publicados.');
    const jobId = randomUUID();
    for (const mode of modes) await tx.update(cvVariants).set({ status: 'pending', error: null }).where(modeFilter(optimizationId, mode));
    await tx.insert(aiJobs).values({ id: jobId, userId, initiatedByUserId: userId, kind: 'optimize_cv_variants', usageOperationId: run.operationId,
      resolvedAiConfig: run.resolvedAiConfig, payload: { optimizationId, modes, requestId, retry: true, inputHash }, nextAttemptAt: new Date(), result: { stage: 'queued', cvId: run.cvId, optimizationId } });
    return { jobId, cvId: run.cvId };
  });
}

/** Lock quota/owner before the job. Re-read owner after a guest claim. */
async function lockPublication(tx: PlanDb, job: AiJob, terminal = false) {
  await lockCvUser(tx, job.userId);
  const [operation] = await tx.select().from(usageOperations).where(eq(usageOperations.id, job.usageOperationId!)).limit(1);
  if (!operation || !['reserved', 'consumed'].includes(operation.status)) throw new CvOptimizationError('OPERATION_RELEASED');
  if (operation.userId !== job.userId) await lockCvUser(tx, operation.userId);
  const [lease] = await tx.select({ id: aiJobs.id }).from(aiJobs).where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, terminal ? 'failed' : 'running'), eq(aiJobs.attempt, job.attempt), ...(terminal ? [] : [gt(aiJobs.leaseUntil, new Date())]))).for('update').limit(1);
  if (!lease) throw new CvOptimizationError('OPTIMIZATION_LEASE_LOST');
  const [run] = await tx.select().from(cvOptimizations).where(and(eq(cvOptimizations.id, jobPayload(job).optimizationId), eq(cvOptimizations.userId, operation.userId))).limit(1);
  if (!run) throw new CvOptimizationError('OPTIMIZATION_NOT_FOUND');
  const [cv] = await tx.select().from(cvs).where(and(eq(cvs.id, run.cvId), eq(cvs.userId, operation.userId))).for('update').limit(1);
  if (!cv || (jobPayload(job).retry ? cv.optimizationId !== run.id || Boolean(cv.pendingUsageOperationId) : cv.pendingUsageOperationId !== operation.id)) throw new CvOptimizationError('STALE_OPTIMIZATION');
  return { run, cv, ownerId: operation.userId };
}

async function checkpoint(job: AiJob, update: (tx: PlanDb) => Promise<unknown>) {
  await db.transaction(async tx => { await lockPublication(tx, job); await update(tx); });
}
export async function readOptimizationProgress(optimizationId: string, stage: OptimizeProgress['stage']): Promise<OptimizeProgress> {
  const [run] = await db.select({ cvId: cvOptimizations.cvId }).from(cvOptimizations).where(eq(cvOptimizations.id, optimizationId)).limit(1);
  if (!run) throw new CvOptimizationError('OPTIMIZATION_NOT_FOUND');
  const variants = await db.select({ modeId: cvVariants.modeId, status: cvVariants.status, error: cvVariants.error }).from(cvVariants).where(eq(cvVariants.optimizationId, optimizationId));
  return { stage, cvId: run.cvId, optimizationId, variants: variants as OptimizeProgress['variants'] };
}
const temperature = { optimize_honest: 0.2, optimize_adapted: 0.4, optimize_aggressive: 0.5 };
export async function processCvOptimization(job: AiJob, signal: AbortSignal, call = callCvAi) {
  const payload = jobPayload(job);
  const { run } = await db.transaction(tx => lockPublication(tx, job));
  const offer = run.offer as OptimizeOffer;
  const model = resolveModelForFunction(parseAiRuntimeConfig(run.resolvedAiConfig), 'optimize_cv', run.subscriptionStatus === 'active' ? 'pro' : 'free').ref;
  const plan = run.subscriptionStatus === 'active' ? 'pro' : 'free';
  const progress = async (stage: OptimizeProgress['stage']) => checkpoint(job, async tx => { await tx.update(aiJobs).set({ result: await readOptimizationProgress(run.id, stage) }).where(eq(aiJobs.id, job.id)); });
  let analysis: CvAnalysis;
  if (run.analysis) analysis = validateAnalysis(run.analysis, run.sourceMarkdown, run.sourceProfile);
  else {
    await progress('analysis');
    const user = analysisUserPrompt(run.sourceMarkdown, run.sourceProfile, offer.jobDescription);
    try {
      analysis = parseAnalysisResponse(await call(model, ANALYSIS_PROMPT, user, 0.15, signal, 'analysis', plan), run.sourceMarkdown, run.sourceProfile);
    } catch (error) {
      if (error instanceof CvOptimizationError && error.retryable) throw error;
      if (error instanceof CvOptimizationError && error.code === 'AI_NOT_CONFIGURED') throw error;
      analysis = parseAnalysisResponse(await call(model, ANALYSIS_PROMPT, `${user}\nLa respuesta anterior no era un análisis JSON válido. Corrige el esquema y las citas literales.`, 0.15, signal, 'analysis-repair', plan), run.sourceMarkdown, run.sourceProfile);
    }
    await checkpoint(job, async tx => { await tx.update(cvOptimizations).set({ analysis }).where(eq(cvOptimizations.id, run.id)); });
  }
  let transient: CvOptimizationError | null = null;
  await progress('generating');
  await Promise.all(payload.modes.map(async mode => {
    const [variant] = await db.select().from(cvVariants).where(modeFilter(run.id, mode)).limit(1);
    if (!variant || variant.status === 'ready') return;
    const started = Date.now();
    await checkpoint(job, async tx => { await tx.update(cvVariants).set({ status: 'generating', error: null, updatedAt: new Date() }).where(modeFilter(run.id, mode)); });
    try {
      const prompts = generationPrompts(mode, run.sourceMarkdown, run.sourceProfile, offer.jobDescription, analysis);
      let content = await call(model, prompts.systemPrompt, prompts.userPrompt, temperature[mode], signal, mode, plan);
      let issues = validateVariant(content, run.sourceMarkdown, run.sourceProfile, analysis);
      if (issues.length) {
        content = await call(model, prompts.systemPrompt, `${prompts.userPrompt}\n\nCorrige tu propuesta inválida usando solo las fuentes. Errores: ${issues.join(', ')}\nPROPUESTA:\n${content}`, temperature[mode], signal, `${mode}:repair`, plan);
        issues = validateVariant(content, run.sourceMarkdown, run.sourceProfile, analysis);
      }
      if (issues.length) throw new CvOptimizationError('INVALID_CV_VARIANT');
      await checkpoint(job, async tx => { await tx.update(cvVariants).set({ content, status: 'ready', error: null, updatedAt: new Date() }).where(modeFilter(run.id, mode)); });
      log({event:'cv_variant_generation_completed',jobId:job.id,modeId:mode,durationMs:Date.now()-started});
    } catch (error) {
      const failure = error instanceof CvOptimizationError ? error : new CvOptimizationError('AI_UNAVAILABLE', true);
      log({event:'cv_variant_generation_failed',level:'warn',jobId:job.id,modeId:mode,durationMs:Date.now()-started,errorCode:failure.code});
      if (failure.code === 'OPTIMIZATION_LEASE_LOST' || failure.code === 'STALE_OPTIMIZATION' || signal.aborted) throw failure;
      if (failure.retryable && job.attempt < 3) transient = failure;
      await checkpoint(job, async tx => { await tx.update(cvVariants).set({ status: failure.retryable && job.attempt < 3 ? 'pending' : 'error', error: failure.code, updatedAt: new Date() }).where(modeFilter(run.id, mode)); });
    }
    await progress('generating');
  }));
  if (transient) throw transient;
  return finalizeCvOptimization(job);
}

export async function finalizeCvOptimization(job: AiJob) {
  return db.transaction(tx => settleCvOptimization(tx, job));
}
async function settleCvOptimization(tx: PlanDb, job: AiJob, terminal = false) {
    const { run, cv, ownerId } = await lockPublication(tx, job, terminal);
    const variants = await tx.select().from(cvVariants).where(eq(cvVariants.optimizationId, run.id));
    const ready = ['optimize_adapted', 'optimize_honest', 'optimize_aggressive'].map(mode => variants.find(v => v.modeId === mode && v.status === 'ready')).find(Boolean);
    if (!ready) throw new CvOptimizationError('NO_USABLE_VARIANTS');
    if (!jobPayload(job).retry) {
      const offer = run.offer as OptimizeOffer;
      if (offer.jobOfferId) {
        const linked = await tx.update(jobOffers).set({ cvId:cv.id }).where(and(eq(jobOffers.id,offer.jobOfferId),eq(jobOffers.userId,ownerId))).returning({id:jobOffers.id});
        if (!linked.length) throw new CvOptimizationError('OFFER_NOT_FOUND');
      } else if (offer.addToApplications) {
        const company = await findOrCreateCompany(ownerId, offer.company, tx);
        const [existing] = await tx.select({ id: jobOffers.id }).from(jobOffers).where(and(eq(jobOffers.userId, ownerId), eq(jobOffers.cvId, cv.id))).limit(1);
        if (!existing) await tx.insert(jobOffers).values({ userId: ownerId, cvId: cv.id, title: offer.jobTitle, company: company?.name || offer.company,
          companyId: company?.id || null, description: offer.jobDescription, url: offer.url, platform: offer.platform, status: 'interested' });
      }
      // Terminal recovery can catch an unavailable application inside this transaction.
      // Resolve its link before changing the preserved destination document.
      await tx.update(cvs).set({ content: ready.content, optimizationId: run.id, activeOptimizeMode: ready.modeId, pendingUsageOperationId: null }).where(eq(cvs.id, cv.id));
      await recordFirstValue(ownerId, tx);
    }
    const result = { stage: 'completed', cvId: cv.id, optimizationId: run.id, variants: variants.map(v => ({ modeId: v.modeId, status: v.status, error: v.error })) };
    await consumeUsage(tx, run.operationId, result);
    await tx.update(aiJobs).set({ status: 'completed', result, lastError: null, leaseUntil: null, completedAt: new Date(), updatedAt: new Date() }).where(eq(aiJobs.id, job.id));
    void createAuditLog('cv_optimize_ai', ownerId, null, { optimizedCvId: cv.id, optimizationId: run.id, retry: Boolean(jobPayload(job).retry) });
    return result;
}

/** Called inside terminal settlement; never disturb a replacement's preserved content. */
export async function failCvOptimization(tx: PlanDb, job: AiJob) {
  const payload = jobPayload(job);
  await tx.update(cvVariants).set({ status: 'error', error: 'GENERATION_FAILED', updatedAt: new Date() }).where(and(eq(cvVariants.optimizationId, payload.optimizationId), sql`${cvVariants.status} IN ('pending', 'generating')`));
  const ready = await tx.select({ mode: cvVariants.modeId }).from(cvVariants).where(and(eq(cvVariants.optimizationId, payload.optimizationId), eq(cvVariants.status, 'ready'))).limit(1);
  if (ready.length) {
    try { await settleCvOptimization(tx, job, true); return; }
    catch (error) { if (!(error instanceof CvOptimizationError) || !['STALE_OPTIMIZATION', 'OPTIMIZATION_NOT_FOUND', 'OPERATION_RELEASED', 'OFFER_NOT_FOUND'].includes(error.code)) throw error; }
  }
  await releaseUsage(tx, job.usageOperationId!);
}

export async function getCvOptimizationView(userId: string, cvId: string): Promise<CvOptimizationView | null> {
  const [cv] = await db.select({ optimizationId: cvs.optimizationId }).from(cvs).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId))).limit(1);
  if (!cv?.optimizationId) return null;
  const [run] = await db.select({ id: cvOptimizations.id, sourceMarkdown: cvOptimizations.sourceMarkdown, analysis: cvOptimizations.analysis }).from(cvOptimizations).where(and(eq(cvOptimizations.id, cv.optimizationId), eq(cvOptimizations.userId, userId), eq(cvOptimizations.cvId, cvId))).limit(1);
  if (!run) return null;
  const variants = await db.select({ modeId: cvVariants.modeId, content: cvVariants.content, status: cvVariants.status, error: cvVariants.error, revision: cvVariants.revision }).from(cvVariants).where(eq(cvVariants.optimizationId, run.id));
  return { ...run, analysis: run.analysis as CvAnalysis | null, variants: variants as CvVariant[] };
}

export async function saveCvVariant(userId: string, cvId: string, content: string, context: VariantSaveContext) {
  return db.transaction(async tx => {
    const editable = await requireEditableCv(tx, userId, cvId);
    if (editable.pendingUsageOperationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'El CV se está generando.');
    const [cv] = await tx.select().from(cvs).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId))).limit(1);
    if (cv.optimizationId !== context.optimizationId || !isOptimizeModeId(context.modeId)) throw new UsageError(409, 'STALE_OPTIMIZATION', 'La optimización ha cambiado. Conserva tu borrador y recarga.');
    const [updated] = await tx.update(cvVariants).set({ content, revision: sql`${cvVariants.revision} + 1`, updatedAt: new Date() }).where(and(modeFilter(context.optimizationId, context.modeId), eq(cvVariants.status, 'ready'), eq(cvVariants.revision, context.revision))).returning({ revision: cvVariants.revision });
    if (!updated) throw new UsageError(409, 'VARIANT_REVISION_CONFLICT', 'Esta versión cambió en otra ventana. Conserva tu borrador antes de recargar.');
    if (cv.activeOptimizeMode === context.modeId) await tx.update(cvs).set({ content }).where(eq(cvs.id, cvId));
    return updated;
  });
}

export async function activateCvVariant(userId: string, cvId: string, optimizationId: string, modeId: OptimizeModeId) {
  return db.transaction(async tx => {
    const editable = await requireEditableCv(tx, userId, cvId);
    if (editable.pendingUsageOperationId) throw new UsageError(409, 'OPERATION_IN_PROGRESS', 'El CV se está generando.');
    const [cv] = await tx.select({ optimizationId: cvs.optimizationId }).from(cvs).where(and(eq(cvs.id, cvId), eq(cvs.userId, userId))).limit(1);
    if (cv.optimizationId !== optimizationId || !isOptimizeModeId(modeId)) throw new UsageError(409, 'STALE_OPTIMIZATION', 'La optimización ha cambiado.');
    const [variant] = await tx.select().from(cvVariants).where(and(modeFilter(optimizationId, modeId), eq(cvVariants.status, 'ready'))).limit(1);
    if (!variant) throw new UsageError(409, 'VARIANT_NOT_READY', 'Esta versión todavía no está disponible.');
    await tx.update(cvs).set({ content: variant.content, activeOptimizeMode: modeId }).where(eq(cvs.id, cvId));
    return { content: variant.content, revision: variant.revision };
  });
}
