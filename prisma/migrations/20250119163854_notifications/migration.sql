/*
  Warnings:

  - Added the required column `notified` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notifyResults` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "notified" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyResults" BOOLEAN NOT NULL;
