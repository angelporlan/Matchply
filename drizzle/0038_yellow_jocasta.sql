CREATE TABLE IF NOT EXISTS "cv_optimization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"cvId" uuid NOT NULL,
	"sourceCvId" uuid,
	"sourceMarkdown" text NOT NULL,
	"sourceProfile" text NOT NULL,
	"offer" jsonb NOT NULL,
	"analysis" jsonb,
	"promptVersion" text NOT NULL,
	"resolvedAiConfig" jsonb NOT NULL,
	"subscriptionStatus" text NOT NULL,
	"operationId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cv_optimization_operationId_unique" UNIQUE("operationId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cv_variant" (
	"optimizationId" uuid NOT NULL,
	"modeId" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cv_variant_optimizationId_modeId_pk" PRIMARY KEY("optimizationId","modeId")
);
--> statement-breakpoint
ALTER TABLE "cv" ADD COLUMN "optimizationId" uuid;--> statement-breakpoint
ALTER TABLE "cv" ADD COLUMN "activeOptimizeMode" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_optimization" ADD CONSTRAINT "cv_optimization_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_optimization" ADD CONSTRAINT "cv_optimization_cvId_cv_id_fk" FOREIGN KEY ("cvId") REFERENCES "public"."cv"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_variant" ADD CONSTRAINT "cv_variant_optimizationId_cv_optimization_id_fk" FOREIGN KEY ("optimizationId") REFERENCES "public"."cv_optimization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cv_optimization_user_created_idx" ON "cv_optimization" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cv_optimization_cv_idx" ON "cv_optimization" ("cvId");