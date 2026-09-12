CREATE TABLE IF NOT EXISTS "application_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_view" ADD CONSTRAINT "application_view_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_view_user_idx" ON "application_view" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "application_view_user_name_idx" ON "application_view" ("userId","name");