/*
  Warnings:

  - Made the column `file_id` on table `NfWorkflow` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "NfWorkflow" DROP CONSTRAINT "NfWorkflow_file_id_fkey";

-- AlterTable
ALTER TABLE "File" ALTER COLUMN "externalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "NfWorkflow" ALTER COLUMN "file_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "NfWorkflow" ADD CONSTRAINT "NfWorkflow_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
