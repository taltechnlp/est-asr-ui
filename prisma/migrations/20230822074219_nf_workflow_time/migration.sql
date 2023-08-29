/*
  Warnings:

  - You are about to drop the column `created_at_utc` on the `NfWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `started_at_utc` on the `NfWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at_utc` on the `NfWorkflow` table. All the data in the column will be lost.
  - Added the required column `utc_time` to the `NfWorkflow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NfWorkflow" DROP COLUMN "created_at_utc",
DROP COLUMN "started_at_utc",
DROP COLUMN "updated_at_utc",
ADD COLUMN     "utc_time" TIMESTAMP(3) NOT NULL;
