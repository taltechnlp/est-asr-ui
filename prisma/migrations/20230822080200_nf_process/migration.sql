/*
  Warnings:

  - The `duration` column on the `NfProcess` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `realtime` column on the `NfProcess` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "NfProcess" DROP COLUMN "duration",
ADD COLUMN     "duration" INTEGER,
DROP COLUMN "realtime",
ADD COLUMN     "realtime" INTEGER;
