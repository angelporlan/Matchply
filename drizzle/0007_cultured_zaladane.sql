ALTER TABLE "user" ALTER COLUMN "isGuest" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mcpProfile" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mcpCvId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_mcpCvId_cv_id_fk" FOREIGN KEY ("mcpCvId") REFERENCES "public"."cv"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
