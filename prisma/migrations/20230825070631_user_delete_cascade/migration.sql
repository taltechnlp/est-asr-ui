-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_uploader_fkey";

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploader_fkey" FOREIGN KEY ("uploader") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
