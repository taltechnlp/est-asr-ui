-- CreateTable
CREATE TABLE "TranscriptCorrection" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "segmentIndices" INTEGER[],
    "originalText" TEXT NOT NULL,
    "correctedText" TEXT,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "llmInteractions" JSONB NOT NULL DEFAULT '[]',
    "processingTimeMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptCorrection_fileId_idx" ON "TranscriptCorrection"("fileId");

-- CreateIndex
CREATE INDEX "TranscriptCorrection_fileId_status_idx" ON "TranscriptCorrection"("fileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptCorrection_fileId_blockIndex_key" ON "TranscriptCorrection"("fileId", "blockIndex");

-- AddForeignKey
ALTER TABLE "TranscriptCorrection" ADD CONSTRAINT "TranscriptCorrection_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
