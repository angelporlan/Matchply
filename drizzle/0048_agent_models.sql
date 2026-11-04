ALTER TABLE "user_llm_credential" ADD COLUMN IF NOT EXISTS "scoutModel" text;
--> statement-breakpoint
ALTER TABLE "user_llm_credential" ADD COLUMN IF NOT EXISTS "researchModel" text;
--> statement-breakpoint
ALTER TABLE "user_llm_credential" ADD COLUMN IF NOT EXISTS "cvModel" text;
