import { sql } from 'drizzle-orm';
import { db } from '@/db';
/** Offer cohorts, not causal attribution. Legacy state never fabricates an event. */
export async function getProductFunnel(userId?: string) {
  const result = await db.execute(sql`
    with cohort as (select id, "userId" from job_offer where "createdAt" >= now() - interval '30 days' ${userId ? sql`and "userId" = ${userId}::uuid` : sql``}),
    milestones as (
      select c.id,
        bool_or(e.kind = 'reviewed') as reviewed,
        bool_or(e.kind = 'sent' or (e.kind = 'status_changed' and e.payload->>'to' = 'applied')) as sent,
        bool_or(e.kind = 'response') as responded,
        bool_or(e.kind = 'status_changed' and e.payload->>'to' = 'interview') as interviewed
      from cohort c left join application_event e on e."offerId" = c.id and e."userId" = c."userId" group by c.id
    ) select count(*)::int as saved, count(*) filter (where reviewed)::int as reviewed,
      count(*) filter (where sent)::int as sent, count(*) filter (where responded)::int as responded,
      count(*) filter (where interviewed)::int as interviewed from milestones
  `);
  const row = result.rows[0] as Record<string, number>;
  const metrics = await db.execute(sql`select
    (select count(*)::int from application_event where kind = 'followup_completed' and "createdAt" >= now() - interval '30 days' ${userId ? sql`and "userId" = ${userId}::uuid` : sql``}) as completed,
    (select count(*)::int from profile_evidence where "createdAt" >= now() - interval '30 days' ${userId ? sql`and "userId" = ${userId}::uuid` : sql``}) as evidence,
    (select count(*)::int from profile_evidence p where exists (
      select 1 from cv_optimization o where o."userId" = p."userId" and o."createdAt" >= now() - interval '30 days'
      and position(p.example in coalesce(nullif(o."sourceProfile", '')::jsonb->>'masterDocument', '')) > 0
      and exists (select 1 from cv_variant v where v."optimizationId" = o.id and v.status = 'ready')
    ) ${userId ? sql`and p."userId" = ${userId}::uuid` : sql``}) as reused,
    (select count(*)::int from application_event where kind = 'document_viewed'  and "createdAt" >= now() - interval '30 days' ${userId ? sql`and "userId" = ${userId}::uuid` : sql``}) as documents`);
  return { saved: Number(row.saved), reviewed: Number(row.reviewed), sent: Number(row.sent), responded: Number(row.responded), interviewed: Number(row.interviewed), ...(metrics.rows[0] as { completed: number; evidence: number; documents: number; reused: number }) };
}
