CREATE TABLE IF NOT EXISTS "problem_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"requestId" text,
	"step" text NOT NULL,
	"route" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "problem_report_request_idx" ON "problem_report" ("requestId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "problem_report_created_idx" ON "problem_report" ("createdAt");