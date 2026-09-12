ALTER TABLE "user" RENAME COLUMN "mcpProfile" TO "careerProfile";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_apiKey_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_apiKeyHash_unique";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "apiKey";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "apiKeyHash";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "apiKeyPrefix";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "mcpCvId";