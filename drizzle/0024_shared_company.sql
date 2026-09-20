ALTER TABLE "company" ADD COLUMN "iconHash" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_icon" (
	"companyId" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"bytes" text NOT NULL,
	"byteSize" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_company" (
	"userId" uuid NOT NULL,
	"companyId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_company_userId_companyId_pk" PRIMARY KEY("userId","companyId")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_icon" ADD CONSTRAINT "company_icon_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_company" ADD CONSTRAINT "user_company_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_company" ADD CONSTRAINT "user_company_companyId_company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_company_company_id_idx" ON "user_company" ("companyId");--> statement-breakpoint
INSERT INTO "user_company" ("userId", "companyId", "createdAt")
SELECT "userId", "id", "createdAt"
FROM "company"
ON CONFLICT ("userId", "companyId") DO NOTHING;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_company_merge" (
	"keeper_id" uuid PRIMARY KEY NOT NULL,
	"nameNormalized" text NOT NULL
);--> statement-breakpoint
INSERT INTO "_company_merge" ("keeper_id", "nameNormalized")
SELECT DISTINCT ON ("nameNormalized") id, "nameNormalized"
FROM "company"
ORDER BY
	"nameNormalized",
	((website IS NOT NULL)::int + (location IS NOT NULL)::int + (sector IS NOT NULL)::int) DESC,
	"createdAt" ASC,
	id ASC;--> statement-breakpoint
UPDATE "company" AS keeper
SET
	website = COALESCE(keeper.website, src.website),
	location = COALESCE(keeper.location, src.location),
	sector = COALESCE(keeper.sector, src.sector)
FROM (
	SELECT
		"nameNormalized",
		(array_agg(website) FILTER (WHERE website IS NOT NULL))[1] AS website,
		(array_agg(location) FILTER (WHERE location IS NOT NULL))[1] AS location,
		(array_agg(sector) FILTER (WHERE sector IS NOT NULL))[1] AS sector
	FROM "company"
	GROUP BY "nameNormalized"
) src
WHERE keeper.id IN (SELECT "keeper_id" FROM "_company_merge")
	AND keeper."nameNormalized" = src."nameNormalized";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_company_dupes" (
	"dupe_id" uuid PRIMARY KEY NOT NULL,
	"keeper_id" uuid NOT NULL
);--> statement-breakpoint
INSERT INTO "_company_dupes" ("dupe_id", "keeper_id")
SELECT company.id, merge."keeper_id"
FROM "company"
JOIN "_company_merge" merge ON merge."nameNormalized" = company."nameNormalized"
WHERE company.id <> merge."keeper_id";--> statement-breakpoint
UPDATE "job_offer" AS offer
SET "companyId" = dupes."keeper_id"
FROM "_company_dupes" AS dupes
WHERE offer."companyId" = dupes."dupe_id";--> statement-breakpoint
UPDATE "company_note" AS note
SET "companyId" = dupes."keeper_id"
FROM "_company_dupes" AS dupes
WHERE note."companyId" = dupes."dupe_id";--> statement-breakpoint
UPDATE "user_company" AS membership
SET "companyId" = dupes."keeper_id"
FROM "_company_dupes" AS dupes
WHERE membership."companyId" = dupes."dupe_id"
	AND NOT EXISTS (
		SELECT 1
		FROM "user_company" existing
		WHERE existing."userId" = membership."userId"
			AND existing."companyId" = dupes."keeper_id"
	);--> statement-breakpoint
DELETE FROM "user_company" AS membership
USING "_company_dupes" AS dupes
WHERE membership."companyId" = dupes."dupe_id";--> statement-breakpoint
DELETE FROM "company" AS company
USING "_company_dupes" AS dupes
WHERE company.id = dupes."dupe_id";--> statement-breakpoint
UPDATE "job_offer" AS offer
SET company = company.name
FROM "company" AS company
WHERE offer."companyId" = company.id
	AND offer.company <> company.name;--> statement-breakpoint
DROP TABLE IF EXISTS "_company_dupes";--> statement-breakpoint
DROP TABLE IF EXISTS "_company_merge";--> statement-breakpoint
ALTER TABLE "company" DROP CONSTRAINT IF EXISTS "company_userId_user_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "company_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "company_user_name_idx";--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN IF EXISTS "userId";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_name_normalized_idx" ON "company" ("nameNormalized");