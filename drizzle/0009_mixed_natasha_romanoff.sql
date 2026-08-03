ALTER TABLE "job_offer" ADD COLUMN "externalSource" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "externalId" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_offer_external_identity_idx" ON "job_offer" ("userId","externalSource","externalId");