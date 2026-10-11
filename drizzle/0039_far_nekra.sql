CREATE TABLE IF NOT EXISTS "ai_request_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"jobId" uuid,
	"functionKey" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"endpoint" text NOT NULL,
	"providerRequestId" text,
	"success" boolean NOT NULL,
	"latencyMs" integer NOT NULL,
	"inputTokens" integer,
	"outputTokens" integer,
	"cachedInputTokens" integer,
	"cacheWriteTokens" integer,
	"reasoningTokens" integer,
	"webSearchCalls" integer DEFAULT 0 NOT NULL,
	"costUsd" numeric(20, 10),
	"costSource" text NOT NULL,
	"pricing" jsonb,
	"errorCode" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_request_usage" ADD CONSTRAINT "ai_request_usage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_request_usage_created_idx" ON "ai_request_usage" ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_request_usage_user_created_idx" ON "ai_request_usage" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_request_usage_function_created_idx" ON "ai_request_usage" ("functionKey","createdAt");