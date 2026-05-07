-- Backfill emailVerified for all pre-existing users so the new email-verification
-- gate at sign-in does not lock them out. New signups going forward will have
-- emailVerified = NULL until they click the verification link.
UPDATE "user" SET "emailVerified" = NOW() WHERE "emailVerified" IS NULL;
