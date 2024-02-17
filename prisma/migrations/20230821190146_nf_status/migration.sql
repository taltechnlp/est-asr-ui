/*
  Warnings:

  - The values [failed] on the enum `NfStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NfStatus_new" AS ENUM ('pending', 'submitted', 'running', 'cached', 'succeeded', 'error');
ALTER TABLE "NfWorkflow" ALTER COLUMN "status" TYPE "NfStatus_new" USING ("status"::text::"NfStatus_new");
ALTER TABLE "NfProcess" ALTER COLUMN "status" TYPE "NfStatus_new" USING ("status"::text::"NfStatus_new");
ALTER TYPE "NfStatus" RENAME TO "NfStatus_old";
ALTER TYPE "NfStatus_new" RENAME TO "NfStatus";
DROP TYPE "NfStatus_old";
COMMIT;
