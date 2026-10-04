-- Existing AI jobs finish with the admission policy that created them. They do
-- not populate the new general/matching allowance; only new admissions do.
INSERT INTO "usage_period" ("userId", "bucket", "periodStart", "used", "reserved")
SELECT DISTINCT j."userId", CASE WHEN j.kind='match_batch' THEN 'matching' ELSE 'general' END,
  CASE WHEN u."isGuest" THEN timestamp '1970-01-01 00:00:00' ELSE date_trunc('month', now() AT TIME ZONE 'UTC') END, 0, 0
FROM "ai_job" j JOIN "user" u ON u.id=j."userId"
WHERE j."usageOperationId" IS NULL
ON CONFLICT ("userId", "bucket", "periodStart") DO NOTHING;
--> statement-breakpoint
INSERT INTO "usage_operation" (
  "userId", "periodId", "bucket", "requestId", "action", "inputHash",
  "units", "consumedUnits", "status", "result", "configVersion", "plan",
  "jobId", "expiresAt", "createdAt", "updatedAt"
)
SELECT j."userId", p.id, p.bucket, 'legacy-ai:' || j.id, 'legacy:' || j.kind,
  encode(sha256(convert_to(j.payload::text, 'UTF8')), 'hex'),
  CASE WHEN j.kind='match_batch' AND jsonb_typeof(j.payload->'offerIds')='array' THEN greatest(1,jsonb_array_length(j.payload->'offerIds')) ELSE 1 END,
  CASE WHEN j.kind='match_batch' AND jsonb_typeof(j.payload->'offerIds')='array' THEN greatest(1,jsonb_array_length(j.payload->'offerIds')) ELSE 1 END,
  'consumed', jsonb_build_object('legacyPolicy',true,'aiJobId',j.id), 0, 'legacy', j.id, j."createdAt", j."createdAt", j."updatedAt"
FROM "ai_job" j JOIN "user" u ON u.id=j."userId"
JOIN "usage_period" p ON p."userId"=j."userId" AND p.bucket=CASE WHEN j.kind='match_batch' THEN 'matching' ELSE 'general' END
AND p."periodStart"=CASE WHEN u."isGuest" THEN timestamp '1970-01-01 00:00:00' ELSE date_trunc('month',now() AT TIME ZONE 'UTC') END
WHERE j."usageOperationId" IS NULL
ON CONFLICT ("userId", "action", "requestId") DO NOTHING;
--> statement-breakpoint
UPDATE "ai_job" j SET "usageOperationId"=o.id
FROM "usage_operation" o
WHERE j."usageOperationId" IS NULL AND o."userId"=j."userId"
AND o.action='legacy:' || j.kind AND o."requestId"='legacy-ai:' || j.id;
