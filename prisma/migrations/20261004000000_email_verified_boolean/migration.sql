-- better-auth expects "emailVerified" to be a boolean and discards cached sessions
-- that carry a timestamp there. The time of confirmation moves to "emailVerifiedAt".
ALTER TABLE "user" RENAME COLUMN "emailVerified" TO "emailVerifiedAt";
ALTER TABLE "user" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
UPDATE "user" SET "emailVerified" = true WHERE "emailVerifiedAt" IS NOT NULL;
