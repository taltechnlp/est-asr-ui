/*
  Warnings:

  - Made the column `token` on table `session` required. This step will fail if there are existing NULL values in that column.
  - Made the column `expiresAt` on table `session` required. This step will fail if there are existing NULL values in that column.

*/

-- Fix account table constraints and columns
ALTER TABLE "account" RENAME CONSTRAINT "Account_pkey" TO "account_pkey";
ALTER TABLE "account" ALTER COLUMN "type" SET DEFAULT 'oauth';
ALTER TABLE "account" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Fix session table constraints and columns  
ALTER TABLE "session" RENAME CONSTRAINT "Session_pkey" TO "session_pkey";
ALTER TABLE "session" ALTER COLUMN "token" SET NOT NULL;
ALTER TABLE "session" ALTER COLUMN "expiresAt" SET NOT NULL;
ALTER TABLE "session" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Fix user table constraints and columns
ALTER TABLE "user" RENAME CONSTRAINT "User_pkey" TO "user_pkey";
ALTER TABLE "user" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Fix verification table
ALTER TABLE "verification" ALTER COLUMN "updatedAt" DROP DEFAULT;
