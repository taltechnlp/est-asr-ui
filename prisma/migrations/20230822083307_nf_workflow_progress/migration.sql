-- AlterTable
ALTER TABLE "NfWorkflow" ADD COLUMN     "failedCount" INTEGER,
ADD COLUMN     "pendingCount" INTEGER,
ADD COLUMN     "progressLength" INTEGER,
ADD COLUMN     "runningCount" INTEGER,
ADD COLUMN     "succeededCount" INTEGER;
