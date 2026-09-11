CREATE TABLE IF NOT EXISTS "ai_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"leaseUntil" timestamp,
	"nextAttemptAt" timestamp,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"lastError" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_job" ADD CONSTRAINT "ai_job_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_job_queue_idx" ON "ai_job" ("status","nextAttemptAt","leaseUntil");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_job_user_idx" ON "ai_job" ("userId","createdAt");
