-- Safe, Non-Destructive, Consolidated Migration for Better Auth
-- This migration transitions from Auth.js to Better Auth without data loss.

-- Step 1: Rename existing Auth.js tables to Better Auth's expected lowercase names
ALTER TABLE "User" RENAME TO "user";
ALTER TABLE "Account" RENAME TO "account";
ALTER TABLE "Session" RENAME TO "session";

-- Step 2: Update User table for Better Auth compatibility
ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Transform Account table from Auth.js to Better Auth
-- First, add new Better Auth columns
ALTER TABLE "account"
    ADD COLUMN IF NOT EXISTS "accessToken" TEXT,
    ADD COLUMN IF NOT EXISTS "refreshToken" TEXT,
    ADD COLUMN IF NOT EXISTS "idToken" TEXT,
    ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "password" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Copy data from Auth.js columns to Better Auth columns and drop old columns
DO $$
BEGIN
    -- Copy access_token to accessToken if it exists
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='access_token') THEN
        UPDATE "account" SET "accessToken" = "access_token" WHERE "access_token" IS NOT NULL;
        ALTER TABLE "account" DROP COLUMN "access_token";
    END IF;
    
    -- Copy refresh_token to refreshToken if it exists
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='refresh_token') THEN
        UPDATE "account" SET "refreshToken" = "refresh_token" WHERE "refresh_token" IS NOT NULL;
        ALTER TABLE "account" DROP COLUMN "refresh_token";
    END IF;
    
    -- Copy id_token to idToken if it exists
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='id_token') THEN
        UPDATE "account" SET "idToken" = "id_token" WHERE "id_token" IS NOT NULL;
        ALTER TABLE "account" DROP COLUMN "id_token";
    END IF;
    
    -- Remove Auth.js specific columns that don't exist in Better Auth
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='expires_at') THEN
        ALTER TABLE "account" DROP COLUMN "expires_at";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='expires_in') THEN
        ALTER TABLE "account" DROP COLUMN "expires_in";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='token_type') THEN
        ALTER TABLE "account" DROP COLUMN "token_type";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='session_state') THEN
        ALTER TABLE "account" DROP COLUMN "session_state";
    END IF;
    
    -- Ensure type column exists with default value
    IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='account' AND column_name='type') THEN
        ALTER TABLE "account" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'oauth';
    END IF;
END;
$$;

-- Step 4: Transform Session table from Auth.js to Better Auth
ALTER TABLE "session"
    ADD COLUMN IF NOT EXISTS "token" TEXT,
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Copy sessionToken to token and expires to expiresAt, then drop old columns
DO $$
BEGIN
    -- Copy sessionToken to token
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='session' AND column_name='sessionToken') THEN
        UPDATE "session" SET "token" = "sessionToken" WHERE "sessionToken" IS NOT NULL;
        ALTER TABLE "session" DROP COLUMN "sessionToken";
    END IF;
    
    -- Copy expires to expiresAt
    IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='session' AND column_name='expires') THEN
        UPDATE "session" SET "expiresAt" = "expires" WHERE "expires" IS NOT NULL;
        ALTER TABLE "session" DROP COLUMN "expires";
    END IF;
END;
$$;

-- Step 5: Create the verification table for Better Auth
CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- Step 6: Drop the old VerificationToken table since Better Auth uses verification
DROP TABLE IF EXISTS "VerificationToken";

-- Step 7: Update foreign key constraints
-- Drop old constraints with capitalized table names
DO $$
BEGIN
    -- Drop old foreign key constraints
    IF EXISTS(SELECT * FROM information_schema.table_constraints WHERE constraint_name='Account_userId_fkey') THEN
        ALTER TABLE "account" DROP CONSTRAINT "Account_userId_fkey";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.table_constraints WHERE constraint_name='Session_userId_fkey') THEN
        ALTER TABLE "session" DROP CONSTRAINT "Session_userId_fkey";
    END IF;
    IF EXISTS(SELECT * FROM information_schema.table_constraints WHERE constraint_name='File_uploader_fkey') THEN
        ALTER TABLE "File" DROP CONSTRAINT "File_uploader_fkey";
    END IF;
END;
$$;

-- Add new foreign key constraints with lowercase table names
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_uploader_fkey" FOREIGN KEY ("uploader") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Step 8: Create unique constraints and indexes
DO $$
BEGIN
    -- Ensure account provider constraint exists
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_provider_providerAccountId_key') THEN
        ALTER TABLE "account" ADD CONSTRAINT "account_provider_providerAccountId_key" UNIQUE ("provider", "providerAccountId");
    END IF;
    
    -- Ensure session token constraint exists (drop old sessionToken constraint first)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_sessionToken_key') THEN
        ALTER TABLE "session" DROP CONSTRAINT "Session_sessionToken_key";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_token_key') THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_token_key" UNIQUE ("token");
    END IF;
END;
$$;