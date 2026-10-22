CREATE TABLE IF NOT EXISTS "cv_photo" (
	"cvId" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"bytes" text NOT NULL,
	"byteSize" integer NOT NULL,
	"hash" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv" ADD COLUMN "showPhoto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cv_photo" ADD CONSTRAINT "cv_photo_cvId_cv_id_fk" FOREIGN KEY ("cvId") REFERENCES "public"."cv"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
