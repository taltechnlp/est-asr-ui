-- CreateEnum
CREATE TYPE "NfStatus" AS ENUM ('pending', 'submitted', 'running', 'cached', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "NfWorkflow" (
    "run_id" TEXT NOT NULL,
    "status" "NfStatus" NOT NULL,
    "request_id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "run_name" TEXT NOT NULL,
    "started_at_utc" TIMESTAMP(3) NOT NULL,
    "created_at_utc" TIMESTAMP(3) NOT NULL,
    "updated_at_utc" TIMESTAMP(3) NOT NULL,
    "result_location" TEXT NOT NULL,
    "file_id" TEXT
);

-- CreateTable
CREATE TABLE "NfProcess" (
    "id" TEXT NOT NULL,
    "task_id" INTEGER NOT NULL,
    "process" TEXT NOT NULL,
    "tag" TEXT,
    "hash" TEXT NOT NULL,
    "status" "NfStatus" NOT NULL,
    "exit" INTEGER,
    "container" TEXT NOT NULL,
    "native_id" INTEGER NOT NULL,
    "submit" TIMESTAMP(3) NOT NULL,
    "duration" TEXT,
    "realtime" TEXT,
    "cpu" DOUBLE PRECISION,
    "mem" DOUBLE PRECISION,
    "peak_rss" DOUBLE PRECISION,
    "peak_vmem" DOUBLE PRECISION,
    "rchar" DOUBLE PRECISION,
    "wchar" DOUBLE PRECISION,
    "vol_ctxt" INTEGER,
    "inv_ctxt" INTEGER,
    "workflow_id" TEXT NOT NULL,

    CONSTRAINT "NfProcess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfWorkflow_run_id_key" ON "NfWorkflow"("run_id");

-- AddForeignKey
ALTER TABLE "NfWorkflow" ADD CONSTRAINT "NfWorkflow_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NfProcess" ADD CONSTRAINT "NfProcess_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "NfWorkflow"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;
