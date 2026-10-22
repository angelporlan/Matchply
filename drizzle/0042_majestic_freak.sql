CREATE TABLE IF NOT EXISTS "application_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"offerId" uuid NOT NULL,
	"commandId" uuid NOT NULL,
	"inputHash" text NOT NULL,
	"kind" text NOT NULL,
	"exportId" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cv_export_data" (
	"exportId" uuid PRIMARY KEY NOT NULL,
	"bytes" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cv_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"cvId" uuid,
	"hash" text NOT NULL,
	"filename" text NOT NULL,
	"byteSize" integer NOT NULL,
	"pages" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"commandId" uuid NOT NULL,
	"inputHash" text NOT NULL,
	"requirement" text NOT NULL,
	"example" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "nextAction" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "followupVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_event" ADD CONSTRAINT "application_event_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_event" ADD CONSTRAINT "application_event_exportId_cv_export_id_fk" FOREIGN KEY ("exportId") REFERENCES "public"."cv_export"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_event" ADD CONSTRAINT "application_event_offerId_userId_job_offer_id_userId_fk" FOREIGN KEY ("offerId","userId") REFERENCES "public"."job_offer"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_export_data" ADD CONSTRAINT "cv_export_data_exportId_cv_export_id_fk" FOREIGN KEY ("exportId") REFERENCES "public"."cv_export"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_export" ADD CONSTRAINT "cv_export_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_export" ADD CONSTRAINT "cv_export_cvId_cv_id_fk" FOREIGN KEY ("cvId") REFERENCES "public"."cv"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_evidence" ADD CONSTRAINT "profile_evidence_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "application_event_command_idx" ON "application_event" ("userId","offerId","commandId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_event_timeline_idx" ON "application_event" ("userId","offerId","createdAt","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_event_cohort_idx" ON "application_event" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cv_export_owner_hash_idx" ON "cv_export" ("userId","hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cv_export_expiry_idx" ON "cv_export" ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cv_export_owner_id_idx" ON "cv_export" ("id","userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_evidence_command_idx" ON "profile_evidence" ("userId","commandId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_evidence_owner_idx" ON "profile_evidence" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_followup_idx" ON "job_offer" ("userId","nextFollowupDate");