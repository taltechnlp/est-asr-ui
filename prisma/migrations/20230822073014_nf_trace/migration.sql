/*
  Warnings:

  - The `exit` column on the `NfProcess` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "NfProcess" ADD COLUMN     "start" TIMESTAMP(3),
DROP COLUMN "exit",
ADD COLUMN     "exit" TIMESTAMP(3),
ALTER COLUMN "submit" DROP NOT NULL;
