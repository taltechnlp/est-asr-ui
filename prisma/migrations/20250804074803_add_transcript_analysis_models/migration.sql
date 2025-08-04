-- CreateTable
CREATE TABLE "TranscriptSummary" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyTopics" TEXT[],
    "speakerCount" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisSegment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "startWord" INTEGER NOT NULL,
    "endWord" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "nBestResults" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptSummary_fileId_key" ON "TranscriptSummary"("fileId");

-- CreateIndex
CREATE INDEX "AnalysisSegment_fileId_idx" ON "AnalysisSegment"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisSegment_fileId_segmentIndex_key" ON "AnalysisSegment"("fileId", "segmentIndex");

-- AddForeignKey
ALTER TABLE "TranscriptSummary" ADD CONSTRAINT "TranscriptSummary_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSegment" ADD CONSTRAINT "AnalysisSegment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
