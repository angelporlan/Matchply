CREATE TABLE IF NOT EXISTS "operational_error" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requestId" text NOT NULL,
	"traceId" text,
	"event" text NOT NULL,
	"code" text NOT NULL,
	"route" text NOT NULL,
	"source" text NOT NULL,
	"digest" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operational_error_request_idx" ON "operational_error" ("requestId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operational_error_trace_idx" ON "operational_error" ("traceId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operational_error_created_idx" ON "operational_error" ("createdAt");