-- Research was charged on admission before plan quotas. Attach a settled operation
-- to each existing run without incrementing the imported monthly counter again.
INSERT INTO "usage_period" ("userId", "bucket", "periodStart", "used", "reserved")
SELECT DISTINCT "userId", 'research', "quotaPeriodStart", 0, 0
FROM "job_research_run"
ON CONFLICT ("userId", "bucket", "periodStart") DO NOTHING;
--> statement-breakpoint
INSERT INTO "usage_operation" (
  "userId", "periodId", "bucket", "requestId", "action", "inputHash",
  "units", "consumedUnits", "status", "result", "configVersion", "plan",
  "jobId", "expiresAt", "createdAt", "updatedAt"
)
SELECT r."userId", p.id, 'research', 'legacy-research:' || r.id, 'research_offer',
  encode(sha256(convert_to('{"jobOfferId":"' || r."jobOfferId" || '"}', 'UTF8')), 'hex'),
  1, 1, 'consumed', jsonb_build_object('legacyPolicy', true, 'researchRunId', r.id),
  0, 'legacy', r.id, r."createdAt", r."createdAt", r."updatedAt"
FROM "job_research_run" r
JOIN "usage_period" p ON p."userId"=r."userId" AND p.bucket='research' AND p."periodStart"=r."quotaPeriodStart"
WHERE r."usageOperationId" IS NULL
ON CONFLICT ("userId", "action", "requestId") DO NOTHING;
--> statement-breakpoint
UPDATE "job_research_run" r SET "usageOperationId"=o.id
FROM "usage_operation" o
WHERE r."usageOperationId" IS NULL AND o."userId"=r."userId"
AND o.action='research_offer' AND o."requestId"='legacy-research:' || r.id;
