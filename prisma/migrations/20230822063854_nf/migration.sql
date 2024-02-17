/*
  Warnings:

  - You are about to drop the column `location` on the `NfWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `request_id` on the `NfWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `result_location` on the `NfWorkflow` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NfWorkflow" DROP COLUMN "location",
DROP COLUMN "request_id",
DROP COLUMN "result_location";
