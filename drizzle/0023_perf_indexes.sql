CREATE INDEX IF NOT EXISTS "audit_log_action_created_idx" ON "audit_log" ("action","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cv_user_updated_idx" ON "cv" ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cv_user_base_principal_idx" ON "cv" ("userId","isBase","isPrincipal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_url_idx" ON "job_offer" ("userId","url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_title_company_idx" ON "job_offer" ("userId","title","company");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_cv_id_idx" ON "job_offer" ("cvId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_key_archived_idx" ON "prompt" ("key","isArchived");