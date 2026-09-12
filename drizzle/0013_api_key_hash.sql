ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "apiKeyHash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "apiKeyPrefix" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_apiKeyHash_unique" UNIQUE("apiKeyHash");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
