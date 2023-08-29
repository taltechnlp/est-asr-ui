-- DropForeignKey
ALTER TABLE "NfWorkflow" DROP CONSTRAINT "NfWorkflow_file_id_fkey";

-- AddForeignKey
ALTER TABLE "NfWorkflow" ADD CONSTRAINT "NfWorkflow_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
