CREATE TABLE IF NOT EXISTS "person_avatar" (
	"personId" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"mime" text NOT NULL,
	"bytes" text NOT NULL,
	"byteSize" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "avatarHash" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_avatar" ADD CONSTRAINT "person_avatar_personId_userId_person_id_userId_fk" FOREIGN KEY ("personId","userId") REFERENCES "public"."person"("id","userId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_avatar_user_idx" ON "person_avatar" ("userId");