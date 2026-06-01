ALTER TABLE "user" ADD COLUMN "apiKey" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_apiKey_unique" UNIQUE("apiKey");