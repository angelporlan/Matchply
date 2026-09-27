CREATE TABLE IF NOT EXISTS "user_api_token" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL,
  "name" text NOT NULL,
  "tokenHash" text NOT NULL,
  "lastChars" text NOT NULL,
  "scopes" jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "lastUsedAt" timestamp,
  "revokedAt" timestamp,
  "expiresAt" timestamp,
  CONSTRAINT "user_api_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "user_api_token_tokenHash_unique" UNIQUE("tokenHash")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_api_token_user_idx" ON "user_api_token" ("userId","createdAt");
