ALTER TABLE "cv" ADD COLUMN "updatedAt" timestamp;
--> statement-breakpoint
UPDATE "cv" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
--> statement-breakpoint
ALTER TABLE "cv" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "cv" ALTER COLUMN "updatedAt" SET NOT NULL;
