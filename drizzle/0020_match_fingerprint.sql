ALTER TABLE "job_offer" ADD COLUMN IF NOT EXISTS "matchInputHash" text;
ALTER TABLE "job_offer" ADD COLUMN IF NOT EXISTS "matchKind" text;
