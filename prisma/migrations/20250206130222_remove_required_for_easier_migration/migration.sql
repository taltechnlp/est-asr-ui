-- AlterTable
ALTER TABLE "File" ALTER COLUMN "notified" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "notifyResults" DROP NOT NULL;

-- RenameIndex
ALTER INDEX "User.email._UNIQUE" RENAME TO "default$default.User.email._UNIQUE";
