/*
  Warnings:

  - You are about to drop the column `notifyResults` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "notify" BOOLEAN;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "notifyResults";
