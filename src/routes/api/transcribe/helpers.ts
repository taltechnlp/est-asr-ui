import { spawn } from "child_process";
import { writeFile } from "fs/promises";
import { existsSync, mkdirSync} from 'fs';
import { prisma } from "$lib/db/client";
import { unlink } from "fs/promises";

export const runNextflow = (
    fileId: string,
    filePath: string,
    workflowName: string,
    resultsDir: string,
    doPunctuation: boolean,
    doSpeakerId: boolean,
    doLanguageId: boolean,
    PIPELINE_DIR: string,
    NEXTFLOW_PROFILE: string,
    EST_ASR_URL: string,
    NEXTFLOW_PATH: string,
  ) => {
    let parameters = [
      "run",
      PIPELINE_DIR + 'transcribe.nf',
      "-profile",
      NEXTFLOW_PROFILE,
      "-name",
      workflowName,
      "-with-weblog",
      EST_ASR_URL + '/api/process',
      "--in",
      filePath,
      "--out_dir",
      resultsDir,
      "--do_punctuation",
      doPunctuation ? "true" : "false",
      "--do_speaker_id",
      doSpeakerId ? "true" : "false",
      "--do_language_id",
      "false" // doLanguageId  ? "true" : "false",
    ];
    console.log("New pipeline", parameters);
    try {
        if (!existsSync(resultsDir)){
            mkdirSync(resultsDir, { recursive: true });
        }
    }
    catch (e) {
        console.log('Failed to create the results directory!', e)
        return false;
    }
    const nextflowProcess = spawn(NEXTFLOW_PATH, parameters, { cwd: resultsDir });
    /* nextflowProcess.stdout.on('data', async (chunk) => {
        await writeFile("nextflow_log.txt", chunk).catch(e => {
            console.log("Writing to log file failed!")
        });
    }) */
    nextflowProcess.on('exit', async function (code) {
        let failed = false;
        if (code === 1 || code == 2) {
            failed = true;
        }
        console.log('Nextflow process', workflowName, 'exited with code ', code, "failed", failed);
        if (fileId && !failed) {
            await prisma.file.update({
            where: {
                id: fileId
            },
            data: {
                state: "READY",
            }
            }).then(()=>{
                console.log("Completed workflow", workflowName)})
            .catch(e => console.log("Failed to update workflow to completed in the DB", workflowName, e))
        } else if (fileId && failed) {
            await prisma.file.update({
                where: {
                    id: fileId
                },
                data: {
                    state: "PROCESSING_ERROR",
                }
                }).then(()=>{
                    console.log("Workflow failed", workflowName)})
                .catch(e => console.log("Failed to update workflow to completed in the DB", workflowName, e))
            await unlink(filePath);
        }
    })
    return true;
  };