CREATE TABLE IF NOT EXISTS "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"nameNormalized" text NOT NULL,
	"website" text,
	"location" text,
	"sector" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companyId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "companyId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company" ADD CONSTRAINT "company_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_note" ADD CONSTRAINT "company_note_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_note" ADD CONSTRAINT "company_note_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_user_id_idx" ON "company" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_user_name_idx" ON "company" ("userId","nameNormalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_note_company_created_idx" ON "company_note" ("companyId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_note_user_id_idx" ON "company_note" ("userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_offer" ADD CONSTRAINT "job_offer_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_offer_user_company_id_idx" ON "job_offer" ("userId","companyId");
--> statement-breakpoint
INSERT INTO "company" ("id", "userId", "name", "nameNormalized", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "userId", name, "nameNormalized", now(), now()
FROM (
  SELECT DISTINCT ON ("userId", lower(btrim(regexp_replace(company, E'\\s+', ' ', 'g'))))
    "userId",
    btrim(regexp_replace(company, E'\\s+', ' ', 'g')) AS name,
    lower(btrim(regexp_replace(company, E'\\s+', ' ', 'g'))) AS "nameNormalized"
  FROM "job_offer"
  WHERE btrim(company) <> ''
  ORDER BY "userId", lower(btrim(regexp_replace(company, E'\\s+', ' ', 'g'))), "updatedAt" DESC
) src;
--> statement-breakpoint
UPDATE "job_offer" AS offer
SET "companyId" = company.id
FROM "company" AS company
WHERE company."userId" = offer."userId"
  AND company."nameNormalized" = lower(btrim(regexp_replace(offer.company, E'\\s+', ' ', 'g')));