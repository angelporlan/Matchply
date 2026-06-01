ALTER TABLE "job_offer" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "livenessStatus" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "scoreOverall" double precision;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "scoreBreakdown" jsonb;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "tldr" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "redFlags" jsonb;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "legitimacyTier" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "rawReport" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "targetProofPoints" jsonb;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "coverLetter" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "outreachMessage" text;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "interviewStories" jsonb;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "nextFollowupDate" timestamp;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "rejectionPatternTags" jsonb;--> statement-breakpoint
ALTER TABLE "prompt" ADD COLUMN "nameEn" text;--> statement-breakpoint
ALTER TABLE "prompt" ADD COLUMN "descriptionEn" text;