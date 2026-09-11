CREATE INDEX IF NOT EXISTS "cv_user_id_idx" ON "cv" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_updated_idx" ON "job_offer" ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_status_idx" ON "job_offer" ("userId","status");
