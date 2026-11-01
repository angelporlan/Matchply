import { AgentApiError, ResearchQuotaError } from '@/lib/agent-api/errors';
import { assertResourceId, asRecord } from '@/lib/agent-api/validate';
import { requireUserFeature } from '@/lib/permissions';
import { enqueueResearchForOffer, getResearchQuota, getResearchRunForUser } from '@/lib/research/queue';

export async function readAgentResearch(userId: string, offerId: string) {
  assertResourceId(offerId, 'No se ha encontrado la candidatura.');
  await requireUserFeature(userId, 'deepResearch');
  const [research, quota] = await Promise.all([
    getResearchRunForUser(userId, offerId),
    getResearchQuota(userId),
  ]);
  return { research, quota };
}

export async function enqueueAgentResearch(userId: string, offerId: string, body: unknown) {
  assertResourceId(offerId, 'No se ha encontrado la candidatura.');
  const record = asRecord(body);
  if ('retry' in record && typeof record.retry !== 'boolean') {
    throw new AgentApiError(400, 'invalid_body', 'retry tiene que ser verdadero o falso.');
  }
  const queued = await enqueueResearchForOffer(userId, offerId, {
    trigger: 'agent_api',
    retryFailed: record.retry === true,
  });
  const quota = await getResearchQuota(userId);
  if (!queued.accepted) throw new ResearchQuotaError(quota);
  return {
    accepted: true as const,
    runId: queued.run?.id ?? null,
    status: queued.status,
    alreadyExists: queued.alreadyExists,
    research: await getResearchRunForUser(userId, offerId),
    quota,
  };
}
