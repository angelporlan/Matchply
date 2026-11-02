import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { Sparkles } from 'lucide-react';
import { db } from '@/db';
import { aiJobs, cvs, jobOffers, jobResearchRuns } from '@/db/schema';
import AgentsWorkspace, { type AgentsWorkspaceProps } from '@/components/agents/AgentsWorkspace';
import { resolveModelForFunction } from '@/lib/ai-runtime-config';
import { getResolvedAiRuntime } from '@/lib/ai-runtime-store';
import { getServerTranslations } from '@/lib/i18n/server';
import { applicationSummaryColumns, baseCvForAiColumns } from '@/lib/job-offer-queries';
import { timed } from '@/lib/logger';
import { latestDiscovery } from '@/lib/offer-discovery/service';
import { userPlanFeature } from '@/lib/plan-store';
import { getDashboardViewer } from '@/lib/session';
import { hasProAccess } from '@/lib/subscription';
import { getPublicLlmCredential } from '@/lib/user-llm-credential';

export const dynamic = 'force-dynamic';

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export default async function AgentsPage() {
  const viewer = await getDashboardViewer();
  if (!viewer) redirect('/login?next=/dashboard/agents');

  const { t } = getServerTranslations();
  const userId = viewer.user.id;
  const isPro = hasProAccess(viewer.user);

  const [credential, discovery, research, cvJob, offers, baseCvRow, canResearch, runtime] = await timed(
    'nav_queries',
    { route: '/dashboard/agents' },
    () => Promise.all([
      getPublicLlmCredential(userId),
      latestDiscovery(userId),
      db.select({
        id: jobResearchRuns.id,
        jobOfferId: jobResearchRuns.jobOfferId,
        status: jobResearchRuns.status,
        lastError: jobResearchRuns.lastError,
        completedAt: jobResearchRuns.completedAt,
        createdAt: jobResearchRuns.createdAt,
      }).from(jobResearchRuns).where(eq(jobResearchRuns.userId, userId)).orderBy(desc(jobResearchRuns.createdAt)).limit(1),
      db.select({
        id: aiJobs.id,
        status: aiJobs.status,
        result: aiJobs.result,
        lastError: aiJobs.lastError,
        createdAt: aiJobs.createdAt,
      }).from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, 'optimize_cv_variants'))).orderBy(desc(aiJobs.createdAt)).limit(1),
      db.select(applicationSummaryColumns).from(jobOffers).where(eq(jobOffers.userId, userId)).orderBy(desc(jobOffers.updatedAt)).limit(20),
      db.select(baseCvForAiColumns).from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.isBase), desc(cvs.isPrincipal)).limit(1),
      userPlanFeature(userId, 'deepResearch'),
      getResolvedAiRuntime(),
    ]),
  );

  const plan = isPro ? 'pro' : 'free';
  const researchRef = resolveModelForFunction(runtime, 'research', plan).ref;
  const cvRef = resolveModelForFunction(runtime, 'optimize_cv', plan).ref;
  const [researchRun] = research;
  const [optimizeJob] = cvJob;
  const [baseCv] = baseCvRow;

  const initial: AgentsWorkspaceProps = {
    credential,
    isGuest: viewer.isGuest,
    impersonation: viewer.impersonation,
    canResearch,
    baseCv: baseCv ? { id: baseCv.id, title: baseCv.title } : null,
    offers: offers.map(offer => ({ id: offer.id, title: offer.title, company: offer.company })),
    scout: discovery ? {
      id: discovery.id,
      status: discovery.status,
      lastError: discovery.lastError,
      result: discovery.result,
    } : null,
    research: researchRun ? {
      id: researchRun.id,
      status: researchRun.status,
      lastError: researchRun.lastError,
      jobOfferId: researchRun.jobOfferId,
      createdAt: iso(researchRun.createdAt) ?? undefined,
      completedAt: iso(researchRun.completedAt),
    } : null,
    cvJob: optimizeJob ? {
      id: optimizeJob.id,
      status: optimizeJob.status,
      lastError: optimizeJob.lastError,
      result: optimizeJob.result,
      createdAt: iso(optimizeJob.createdAt) ?? undefined,
    } : null,
    jobProviders: { scout: 'openai', research: researchRef.provider, cv: cvRef.provider },
  };

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai/10 text-ai text-xs font-bold font-sans">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('agents.title')}</span>
            </div>
            <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold text-text font-display">
              {t('agents.title')}
            </h1>
            <p className="text-xs sm:text-sm text-text-muted font-sans max-w-2xl">
              {t('agents.subtitle')}
            </p>
          </div>
        </div>
        <AgentsWorkspace {...initial} />
      </main>
    </div>
  );
}
