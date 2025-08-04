-- AlterTable
ALTER TABLE "TranscriptSummary" ADD COLUMN     "displayKeyTopics" TEXT[] DEFAULT ARRAY[]::TEXT[];
