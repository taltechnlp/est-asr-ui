/*
  Warnings:

  - You are about to drop the column `container` on the `NfProcess` table. All the data in the column will be lost.
  - You are about to drop the column `native_id` on the `NfProcess` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NfProcess" DROP COLUMN "container",
DROP COLUMN "native_id",
ADD COLUMN     "complete" TIMESTAMP(3);
