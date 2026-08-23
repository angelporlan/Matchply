CREATE TABLE IF NOT EXISTS "extension_installation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"tokenPrefix" text NOT NULL,
	"extensionVersion" text,
	"status" text DEFAULT 'active' NOT NULL,
	"lastSeenAt" timestamp,
	"lastCaptureAt" timestamp,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "extension_installation_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extension_pairing_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"codeHash" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	CONSTRAINT "extension_pairing_code_codeHash_unique" UNIQUE("codeHash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_research_agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"researchRunId" uuid NOT NULL,
	"role" text NOT NULL,
	"provider" text,
	"model" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_research_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"jobOfferId" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"trigger" text DEFAULT 'extension_capture' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"leaseUntil" timestamp,
	"nextAttemptAt" timestamp,
	"quotaPeriodStart" timestamp NOT NULL,
	"engineVersion" text DEFAULT 'linkedin-research-v1' NOT NULL,
	"lastError" text,
	"scoreOverall" double precision,
	"confidence" double precision,
	"report" jsonb,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_research_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"researchRunId" uuid NOT NULL,
	"agentRunId" uuid,
	"url" text NOT NULL,
	"canonicalUrl" text NOT NULL,
	"title" text,
	"domain" text,
	"sourceType" text DEFAULT 'web' NOT NULL,
	"publishedAt" timestamp,
	"retrievedAt" timestamp DEFAULT now() NOT NULL,
	"excerpt" text,
	"contentHash" text NOT NULL,
	"confidence" double precision,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_quota_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"periodStart" timestamp NOT NULL,
	"usedOffers" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "sourceMetadata" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_installation" ADD CONSTRAINT "extension_installation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extension_pairing_code" ADD CONSTRAINT "extension_pairing_code_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_research_agent_run" ADD CONSTRAINT "job_research_agent_run_researchRunId_job_research_run_id_fk" FOREIGN KEY ("researchRunId") REFERENCES "public"."job_research_run"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_research_run" ADD CONSTRAINT "job_research_run_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_research_run" ADD CONSTRAINT "job_research_run_jobOfferId_job_offer_id_fk" FOREIGN KEY ("jobOfferId") REFERENCES "public"."job_offer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_research_source" ADD CONSTRAINT "job_research_source_researchRunId_job_research_run_id_fk" FOREIGN KEY ("researchRunId") REFERENCES "public"."job_research_run"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_research_source" ADD CONSTRAINT "job_research_source_agentRunId_job_research_agent_run_id_fk" FOREIGN KEY ("agentRunId") REFERENCES "public"."job_research_agent_run"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_quota_period" ADD CONSTRAINT "research_quota_period_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_installation_user_idx" ON "extension_installation" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_installation_status_idx" ON "extension_installation" ("status","expiresAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extension_pairing_code_user_status_idx" ON "extension_pairing_code" ("userId","expiresAt","consumedAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_research_agent_run_role_idx" ON "job_research_agent_run" ("researchRunId","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_research_run_queue_idx" ON "job_research_run" ("status","nextAttemptAt","leaseUntil");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_research_run_offer_idx" ON "job_research_run" ("jobOfferId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_research_run_user_idx" ON "job_research_run" ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_research_run_quota_offer_idx" ON "job_research_run" ("userId","quotaPeriodStart","jobOfferId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_research_source_run_canonical_idx" ON "job_research_source" ("researchRunId","canonicalUrl");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_research_source_run_idx" ON "job_research_source" ("researchRunId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_quota_period_user_period_idx" ON "research_quota_period" ("userId","periodStart");