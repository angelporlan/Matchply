ALTER TABLE "user" ADD COLUMN "isGuest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "guestTokenHash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "guestExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_guestTokenHash_unique" UNIQUE("guestTokenHash");
