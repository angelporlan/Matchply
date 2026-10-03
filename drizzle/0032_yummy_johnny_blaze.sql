DROP INDEX IF EXISTS "application_view_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "application_view_user_name_idx";--> statement-breakpoint
ALTER TABLE "application_view" ADD COLUMN "entity" text DEFAULT 'applications' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "isFavorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "isFavorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_company" ADD COLUMN "isFavorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_favorite_idx" ON "job_offer" ("userId","isFavorite","updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_user_favorite_idx" ON "person" ("userId","isFavorite","updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_company_favorite_idx" ON "user_company" ("userId","isFavorite","companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_view_user_idx" ON "application_view" ("userId","entity");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "application_view_user_name_idx" ON "application_view" ("userId","entity","name");