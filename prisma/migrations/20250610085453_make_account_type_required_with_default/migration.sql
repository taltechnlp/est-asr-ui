/*
  Warnings:

  - Made the column `type` on table `account` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "account" ALTER COLUMN "type" SET NOT NULL;
