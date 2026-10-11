CREATE TABLE IF NOT EXISTS "api_usage_window" (
	"userId" uuid NOT NULL,
	"windowStart" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_window_userId_windowStart_pk" PRIMARY KEY("userId","windowStart")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_checkout_attempt" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"requestId" uuid NOT NULL,
	"interval" text NOT NULL,
	"sessionId" text,
	"url" text,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cv_plan_selection" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"baseCvId" uuid,
	"adaptedCvIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monetization_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"experimentVersion" integer NOT NULL,
	"variant" text NOT NULL,
	"firstExposedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monetization_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"experimentVersion" integer NOT NULL,
	"variant" text NOT NULL,
	"event" text NOT NULL,
	"source" text NOT NULL,
	"externalId" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monetization_event_externalId_unique" UNIQUE("externalId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_config_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"updatedByUserId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_config_history_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_config" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"updatedByUserId" uuid,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"eventType" text NOT NULL,
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_item" (
	"operationId" uuid NOT NULL,
	"itemKey" text NOT NULL,
	CONSTRAINT "usage_item_operationId_itemKey_pk" PRIMARY KEY("operationId","itemKey")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"periodId" uuid NOT NULL,
	"bucket" text NOT NULL,
	"requestId" text NOT NULL,
	"action" text NOT NULL,
	"inputHash" text NOT NULL,
	"units" integer NOT NULL,
	"consumedUnits" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"result" jsonb,
	"configVersion" integer NOT NULL,
	"plan" text NOT NULL,
	"jobId" uuid,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"bucket" text NOT NULL,
	"periodStart" timestamp NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_job" ADD COLUMN "usageOperationId" uuid;--> statement-breakpoint
ALTER TABLE "cv" ADD COLUMN "pendingUsageOperationId" uuid;--> statement-breakpoint
ALTER TABLE "job_research_run" ADD COLUMN "usageOperationId" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripePriceId" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "billingInterval" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripeTrialEnd" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripeCurrentPeriodEnd" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripeCancelAtPeriodEnd" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripeTrialUsedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripePaidAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "firstValueAt" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_usage_window" ADD CONSTRAINT "api_usage_window_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_checkout_attempt" ADD CONSTRAINT "billing_checkout_attempt_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_plan_selection" ADD CONSTRAINT "cv_plan_selection_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monetization_assignment" ADD CONSTRAINT "monetization_assignment_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monetization_event" ADD CONSTRAINT "monetization_event_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plan_config_history" ADD CONSTRAINT "plan_config_history_updatedByUserId_user_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plan_config" ADD CONSTRAINT "plan_config_updatedByUserId_user_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_item" ADD CONSTRAINT "usage_item_operationId_usage_operation_id_fk" FOREIGN KEY ("operationId") REFERENCES "public"."usage_operation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_operation" ADD CONSTRAINT "usage_operation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_operation" ADD CONSTRAINT "usage_operation_periodId_usage_period_id_fk" FOREIGN KEY ("periodId") REFERENCES "public"."usage_period"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_period" ADD CONSTRAINT "usage_period_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monetization_assignment_identity_idx" ON "monetization_assignment" ("userId","experimentVersion");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monetization_event_user_idx" ON "monetization_event" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monetization_event_experiment_idx" ON "monetization_event" ("experimentVersion","event","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_operation_identity_idx" ON "usage_operation" ("userId","action","requestId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_operation_expiry_idx" ON "usage_operation" ("status","expiresAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_operation_job_idx" ON "usage_operation" ("jobId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_period_identity_idx" ON "usage_period" ("userId","bucket","periodStart");
--> statement-breakpoint
INSERT INTO plan_config (id,version,config) VALUES (1,1,'{"version":1,"free":{"maxCvs":3,"maxBaseCvs":1,"maxAdaptedCvs":2,"generalAiMonthly":10,"matchingMonthly":10,"researchMonthly":0,"matchBatchSize":1,"apiKeys":0,"apiRequestsPerMinute":0},"guest":{"maxCvs":3,"maxBaseCvs":1,"maxAdaptedCvs":2,"generalAiMonthly":10,"matchingMonthly":10,"researchMonthly":0,"matchBatchSize":1,"apiKeys":0,"apiRequestsPerMinute":0},"pro":{"maxCvs":null,"maxBaseCvs":null,"maxAdaptedCvs":null,"generalAiMonthly":200,"matchingMonthly":300,"researchMonthly":10,"matchBatchSize":50,"apiKeys":3,"apiRequestsPerMinute":60},"paywall":{"experimentVersion":1,"mode":"ab","copy":{"a":{"es":{"title":"Tu primer CV adaptado ya está listo","body":"Conserva esta candidatura y prepara la siguiente. PRO incluye versiones de CV sin límite y {generalAiMonthly} acciones de IA al mes.","cta":"Probar PRO 7 días"},"en":{"title":"Your first tailored resume is ready","body":"Keep this application and prepare the next. PRO includes unlimited resume versions and {generalAiMonthly} AI actions per month.","cta":"Try PRO for 7 days"}},"b":{"es":{"title":"Avanza con más candidaturas","body":"PRO incluye {matchingMonthly} matching al mes, análisis en lote y {researchMonthly} investigaciones profundas.","cta":"Probar PRO 7 días"},"en":{"title":"Move forward with more applications","body":"PRO includes {matchingMonthly} matches per month, batch analysis and {researchMonthly} deep research reports.","cta":"Try PRO for 7 days"}}}}}'::jsonb) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO plan_config_history (version,config) SELECT version,config FROM plan_config WHERE id=1 ON CONFLICT (version) DO NOTHING;
--> statement-breakpoint
INSERT INTO usage_period ("userId",bucket,"periodStart",used,reserved) SELECT "userId",'research',"periodStart","usedOffers",0 FROM research_quota_period ON CONFLICT ("userId",bucket,"periodStart") DO NOTHING;
--> statement-breakpoint
ALTER TABLE usage_period ADD CONSTRAINT usage_period_nonnegative CHECK (used >= 0 AND reserved >= 0);
--> statement-breakpoint
ALTER TABLE usage_operation ADD CONSTRAINT usage_operation_valid CHECK (units > 0 AND "consumedUnits" >= 0 AND "consumedUnits" <= units AND status IN ('reserved','consumed','released'));
