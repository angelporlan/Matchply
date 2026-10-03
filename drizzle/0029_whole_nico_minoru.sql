CREATE TABLE IF NOT EXISTS "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"linkedinUrl" text,
	"email" text,
	"role" text,
	"headline" text,
	"location" text,
	"kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"origin" text,
	"objective" text,
	"topics" text,
	"notes" text,
	"nextAction" text,
	"nextFollowupAt" timestamp,
	"language" text DEFAULT 'es' NOT NULL,
	"tone" text DEFAULT 'professional' NOT NULL,
	"connectionDegree" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_ai_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jobId" uuid NOT NULL,
	"personId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"action" text NOT NULL,
	"inputHash" text NOT NULL,
	"context" jsonb NOT NULL,
	"advice" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_ai_result_jobId_unique" UNIQUE("jobId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_company" (
	"personId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"companyId" uuid NOT NULL,
	"relation" text DEFAULT 'unconfirmed' NOT NULL,
	CONSTRAINT "person_company_personId_companyId_relation_pk" PRIMARY KEY("personId","companyId","relation")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"threadId" uuid NOT NULL,
	"rawText" text NOT NULL,
	"rawHash" text NOT NULL,
	"proposed" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"threadId" uuid NOT NULL,
	"importId" uuid,
	"author" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_offer" (
	"personId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"offerId" uuid NOT NULL,
	CONSTRAINT "person_offer_personId_offerId_pk" PRIMARY KEY("personId","offerId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"channel" text DEFAULT 'linkedin' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_owner_identity_idx" ON "person" ("id","userId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_user_linkedin_idx" ON "person" ("userId","linkedinUrl");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_user_updated_idx" ON "person" ("userId","updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_user_status_idx" ON "person" ("userId","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_user_followup_idx" ON "person" ("userId","nextFollowupAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_ai_result_user_idx" ON "person_ai_result" ("userId","personId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_company_user_idx" ON "person_company" ("userId","companyId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_import_hash_idx" ON "person_import" ("threadId","rawHash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_import_user_idx" ON "person_import" ("userId","personId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_message_position_idx" ON "person_message" ("threadId","position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_message_user_idx" ON "person_message" ("userId","personId","sentAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_offer_user_idx" ON "person_offer" ("userId","offerId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_thread_owner_idx" ON "person_thread" ("id","personId","userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_thread_user_idx" ON "person_thread" ("userId","personId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_offer_owner_identity_idx" ON "job_offer" ("id","userId");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person" ADD CONSTRAINT "person_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_ai_result" ADD CONSTRAINT "person_ai_result_personId_userId_person_id_userId_fk" FOREIGN KEY ("personId","userId") REFERENCES "public"."person"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_company" ADD CONSTRAINT "person_company_personId_userId_person_id_userId_fk" FOREIGN KEY ("personId","userId") REFERENCES "public"."person"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_company" ADD CONSTRAINT "person_company_userId_companyId_user_company_userId_companyId_fk" FOREIGN KEY ("userId","companyId") REFERENCES "public"."user_company"("userId","companyId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_import" ADD CONSTRAINT "person_import_threadId_personId_userId_person_thread_id_personId_userId_fk" FOREIGN KEY ("threadId","personId","userId") REFERENCES "public"."person_thread"("id","personId","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_message" ADD CONSTRAINT "person_message_importId_person_import_id_fk" FOREIGN KEY ("importId") REFERENCES "public"."person_import"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_message" ADD CONSTRAINT "person_message_threadId_personId_userId_person_thread_id_personId_userId_fk" FOREIGN KEY ("threadId","personId","userId") REFERENCES "public"."person_thread"("id","personId","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_offer" ADD CONSTRAINT "person_offer_personId_userId_person_id_userId_fk" FOREIGN KEY ("personId","userId") REFERENCES "public"."person"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_offer" ADD CONSTRAINT "person_offer_offerId_userId_job_offer_id_userId_fk" FOREIGN KEY ("offerId","userId") REFERENCES "public"."job_offer"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_thread" ADD CONSTRAINT "person_thread_personId_userId_person_id_userId_fk" FOREIGN KEY ("personId","userId") REFERENCES "public"."person"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
