/*
  Warnings:

  - A unique constraint covering the columns `[run_name]` on the table `NfWorkflow` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "NfWorkflow_run_name_key" ON "NfWorkflow"("run_name");
