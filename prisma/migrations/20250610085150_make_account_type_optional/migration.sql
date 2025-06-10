-- AlterTable
ALTER TABLE "account" ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'oauth';
