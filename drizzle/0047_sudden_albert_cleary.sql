CREATE TABLE IF NOT EXISTS "user_llm_credential" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"keyCipher" text NOT NULL,
	"lastChars" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_llm_credential" ADD CONSTRAINT "user_llm_credential_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
