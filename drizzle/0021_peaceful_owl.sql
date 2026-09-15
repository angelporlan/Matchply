ALTER TABLE "job_offer" ADD COLUMN "matchEvidence" jsonb;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "matchDetails" jsonb;--> statement-breakpoint
ALTER TABLE "job_offer" ADD COLUMN "matchEvaluatedAt" timestamp;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION matchply_invalidate_offer_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.title, OLD.company, OLD.description, OLD.platform, OLD."sourceMetadata")
    IS DISTINCT FROM ROW(NEW.title, NEW.company, NEW.description, NEW.platform, NEW."sourceMetadata") THEN
    NEW."matchInputHash" := NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER matchply_offer_source_changed BEFORE UPDATE ON job_offer
FOR EACH ROW EXECUTE FUNCTION matchply_invalidate_offer_match();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION matchply_invalidate_profile_matches() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD."careerProfile" - 'updatedAt') IS DISTINCT FROM (NEW."careerProfile" - 'updatedAt') THEN
    UPDATE job_offer SET "matchInputHash" = NULL WHERE "userId" = NEW.id AND "matchInputHash" IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER matchply_profile_source_changed AFTER UPDATE OF "careerProfile" ON "user"
FOR EACH ROW EXECUTE FUNCTION matchply_invalidate_profile_matches();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION matchply_invalidate_cv_matches() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen cv%ROWTYPE; owner_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(OLD.content, OLD."isBase", OLD."isPrincipal", OLD."userId", OLD."createdAt")
    IS NOT DISTINCT FROM ROW(NEW.content, NEW."isBase", NEW."isPrincipal", NEW."userId", NEW."createdAt") THEN
    RETURN NEW;
  END IF;
  owner_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."userId" ELSE NEW."userId" END;
  SELECT * INTO chosen FROM cv WHERE "userId" = owner_id
    ORDER BY "isBase" DESC, "isPrincipal" DESC, "createdAt" DESC, id DESC LIMIT 1;
  IF chosen.id IS NULL
    OR (TG_OP <> 'DELETE' AND NEW.id = chosen.id)
    OR (TG_OP <> 'INSERT' AND ROW(OLD."isBase", OLD."isPrincipal", OLD."createdAt", OLD.id)
      >= ROW(chosen."isBase", chosen."isPrincipal", chosen."createdAt", chosen.id)) THEN
    UPDATE job_offer SET "matchInputHash" = NULL WHERE "userId" = owner_id AND "matchInputHash" IS NOT NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."userId" <> NEW."userId" THEN
    UPDATE job_offer SET "matchInputHash" = NULL WHERE "userId" = OLD."userId" AND "matchInputHash" IS NOT NULL;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER matchply_cv_source_changed AFTER INSERT OR UPDATE OR DELETE ON cv
FOR EACH ROW EXECUTE FUNCTION matchply_invalidate_cv_matches();
