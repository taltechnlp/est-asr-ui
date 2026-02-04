import { spawn, execFile } from "child_process";
import { existsSync, mkdirSync} from 'fs';
import { join } from 'path';

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

    const workDir = join(pipelineDir, 'work', workflowName);

    let parameters = [
        "-bg",
        "run",
      pipelineDir + '/transcribe.nf',
      "-work-dir",
      workDir,
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

    // Handle spawn errors (e.g., nextflow not found) to prevent server crash
    nextflowProcess.on('error', (err) => {
        console.error(`[NEXTFLOW] Failed to start process: ${err.message}`);
        if (err.code === 'ENOENT') {
            console.error(`[NEXTFLOW] Executable not found at path: ${nextflowPath}`);
        }
    });

    // Unref to allow the parent process to exit independently
    nextflowProcess.unref();

    return true;
  };