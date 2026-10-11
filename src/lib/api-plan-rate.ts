import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { apiUsageWindows } from '@/db/schema';
import { getUserPlan } from '@/lib/plan-store';
import { AgentApiError } from '@/lib/agent-api/errors';
export async function consumeApiPlanRate(userId: string, now = new Date()) {
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  return db.transaction(async tx => {
    const { limits } = await getUserPlan(userId, tx);
    const cap = limits.apiRequestsPerMinute;
    if (cap === 0 || limits.apiKeys === 0) throw new AgentApiError(403, 'subscription_required', 'Tu plan no permite la API de agentes.');
    const result = await tx.execute(sql`INSERT INTO api_usage_window ("userId","windowStart",count) VALUES (${userId},${windowStart.toISOString()},1)
      ON CONFLICT ("userId","windowStart") DO UPDATE SET count=api_usage_window.count+1 WHERE api_usage_window.count < ${cap} RETURNING count`);
    if (!result.rows.length) throw new AgentApiError(429, 'rate_limited', 'Has alcanzado el límite de peticiones de tu cuenta.', Math.ceil((windowStart.getTime()+60_000-now.getTime())/1000));
    await tx.delete(apiUsageWindows).where(and(eq(apiUsageWindows.userId,userId),lt(apiUsageWindows.windowStart,new Date(windowStart.getTime()-120_000))));
  });
}
