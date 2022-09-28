-- CreateTable
CREATE TABLE "File" (
    "id" VARCHAR(30) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UPLOADED',
    "text" TEXT,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "duration" DECIMAL(65,30),
    "uploadedAt" TIMESTAMP(3),
    "mimetype" TEXT NOT NULL,
    "encoding" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "textTitle" TEXT,
    "initialTranscriptionPath" TEXT,
    "initialTranscription" TEXT,
    "uploader" VARCHAR(30),

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(30) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" DECIMAL(65,30),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "default$default.User.email._UNIQUE" ON "User"("email");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploader_fkey" FOREIGN KEY ("uploader") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
