/*
  Warnings:

  - You are about to drop the column `status` on the `NfWorkflow` table. All the data in the column will be lost.
  - Added the required column `event` to the `NfWorkflow` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NfEvent" AS ENUM ('started', 'process_submitted', 'process_started', 'process_completed', 'error', 'completed');

-- AlterTable
ALTER TABLE "NfWorkflow" DROP COLUMN "status",
ADD COLUMN     "event" "NfEvent" NOT NULL;
