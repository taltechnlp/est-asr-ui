import { spawn, execFile } from "child_process";
import { existsSync, mkdirSync} from 'fs';

// Escape glob metacharacters in file path for Nextflow
const escapeGlobPattern = (path: string): string => {
    return path.replace(/([*?[\]{}])/g, '\\$1');
};

export const runNextflow = (
    fileId: string,
    filePath: string,
    workflowName: string,
    resultsDir: string,
    resume: boolean,
    doPunctuation: boolean,
    doSpeakerId: boolean,
    doLanguageId: boolean,
    pipelineDir: string,
    nextflowProfile: string,
    estAsrUrl: string,
    nextflowPath: string,
  ) => {
    // Escape glob metacharacters in the file path
    const escapedFilePath = escapeGlobPattern(filePath);

    let parameters = [
        "-bg",
        "run",
      pipelineDir + '/transcribe.nf',
      "-profile",
      nextflowProfile,
      "-name",
      workflowName,
      "-with-weblog",
      estAsrUrl + '/api/process',
      "--in",
      escapedFilePath,
      "--out_dir",
      resultsDir,
      "--do_punctuation",
      doPunctuation ? "true" : "false",
      "--do_speaker_id",
      doSpeakerId ? "true" : "false",
      "--do_language_id",
      "false" // doLanguageId  ? "true" : "false",
    ];
    if (resume) {
      parameters.push("-resume");
    }
    try {
        if (!existsSync(resultsDir)){
            mkdirSync(resultsDir, { recursive: true });
        }
    }
    catch (e) {
        console.log('Failed to create the results directory!', e)
        return false;
    }
    /* const nextflowProcess = execFile(nextflowPath, parameters, { 
        cwd: pipelineDir,
    }); */

    const nextflowProcess = spawn(nextflowPath, parameters, { 
        detached: true,
        stdio: 'ignore',
        cwd: pipelineDir
    });
    /* nextflowProcess.stdout.on('data', async (chunk) => {
        await writeFile("nextflow_log.txt", chunk).catch(e => {
            console.log("Writing to log file failed!")
        });
    }) */
    /* nextflowProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    }); */

    /* nextflowProcess.on('exit', async function (code) {
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
    }) */
    return true;
  };