ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accountStatus" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspensionReason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspendedByUserId" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "proGrantedUntil" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "proGrantedReason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "proGrantedByUserId" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_created_id_idx" ON "user" ("createdAt","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_last_seen_idx" ON "user" ("lastSeenAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_last_login_idx" ON "user" ("lastLoginAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_account_status_idx" ON "user" ("accountStatus");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_pro_granted_idx" ON "user" ("proGrantedUntil");--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "actorUserId" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "affectedUserId" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "supportSessionId" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "requestId" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'ordinary' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_actor_created_idx" ON "audit_log" ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_affected_created_idx" ON "audit_log" ("affectedUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_category_created_idx" ON "audit_log" ("category","createdAt");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_affectedUserId_user_id_fk" FOREIGN KEY ("affectedUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "ai_job" ADD COLUMN IF NOT EXISTS "initiatedByUserId" uuid;--> statement-breakpoint
ALTER TABLE "ai_job" ADD COLUMN IF NOT EXISTS "resolvedAiConfig" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_job_initiated_by_idx" ON "ai_job" ("initiatedByUserId","createdAt");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_job" ADD CONSTRAINT "ai_job_initiatedByUserId_user_id_fk" FOREIGN KEY ("initiatedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actorUserId" uuid NOT NULL,
	"targetUserId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"endedAt" timestamp,
	CONSTRAINT "support_session_tokenHash_unique" UNIQUE("tokenHash")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_session" ADD CONSTRAINT "support_session_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_session" ADD CONSTRAINT "support_session_targetUserId_user_id_fk" FOREIGN KEY ("targetUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_session_actor_idx" ON "support_session" ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_session_target_idx" ON "support_session" ("targetUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_session_expires_idx" ON "support_session" ("expiresAt","revokedAt");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_runtime_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"config" jsonb NOT NULL,
	"updatedByUserId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_runtime_config" ADD CONSTRAINT "ai_runtime_config_updatedByUserId_user_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_runtime_config_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"updatedByUserId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_runtime_config_history" ADD CONSTRAINT "ai_runtime_config_history_updatedByUserId_user_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_runtime_config_history_version_idx" ON "ai_runtime_config_history" ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_runtime_config_history_created_idx" ON "ai_runtime_config_history" ("createdAt");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_run_stat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"functionKey" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"plan" text NOT NULL,
	"success" boolean NOT NULL,
	"latencyMs" integer,
	"inputTokens" integer,
	"outputTokens" integer,
	"estimatedCostUsd" double precision,
	"errorCode" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_run_stat_created_idx" ON "ai_run_stat" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_run_stat_function_created_idx" ON "ai_run_stat" ("functionKey","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_run_stat_provider_created_idx" ON "ai_run_stat" ("provider","createdAt");
