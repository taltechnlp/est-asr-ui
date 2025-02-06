import { unlink } from "fs/promises";
import { prisma } from "$lib/db/client";
import { createWriteStream, stat } from "fs";
import path from "path";
import type {
    EditorContent,
    EstResult,
    FinAsrFinished,
    FinAsrResult,
    SectionType,
    TranscriberResult,
} from "./api.d";
import { EST_ASR_URL, FIN_ASR_RESULTS_URL, RESULTS_DIR } from "$env/static/private";
import { logger } from "../logging/client";

let finToEstFormat: (sucRes: FinAsrFinished) => EditorContent = function (
    sucRes: FinAsrFinished,
) {
    const result = {
        speakers: {
            S1: {
                name: "S1",
            },
        },
        sections: [{
            start: 0,
            end: 0,
            type: "non-speech" as SectionType,
        }],
    };
    if (
        sucRes.result && sucRes.result.sections && sucRes.result.sections.length > 0
    ) {
        result.sections = sucRes.result.sections.map(
            (seg) => {
                return {
                    start: seg.start,
                    end: seg.end,
                    type: "speech" as SectionType,
                    turns: [{
                        start: seg.start,
                        end: seg.end,
                        speaker: "S1",
                        transcript: seg.transcript,
                        unnormalized_transcript: seg.transcript,
                        words: seg.words.map((w) => {
                            return {
                                confidence: 1,
                                start: w.start + seg.start,
                                end: w.end + seg.start,
                                punctuation: "",
                                word: w.word,
                                word_with_punctuation: w.word,
                            };
                        }),
                    }],
                };
            },
        );
    }

    return result;
};
/* export const generatePeaks = async (fileId) => {
    const file = await prisma.file.findUnique({
        where: {
            id: fileId,
        },
    });
    let processFailed = false;
    const wavPath = file.path + ".wav";
    let peaksPath = file.path + ".json";
    // ffmpeg - i!{ audio_file } -f sox - | sox - t sox - -c 1 - b 16 - t wav audio.wav rate - v 16k
    const toWav = new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", ["-i", file.path, wavPath]);
        ffmpeg.on("exit", function (code) {
            console.log("ffmpeg finished with " + code);
            if (code === 1 || code == 2) {
                processFailed = true;
            }
            resolve(true);
        });
    });
    await toWav.catch((e) => processFailed = true);
    if (processFailed) {
        return false;
    }
    const peaksDone = new Promise((resolve, reject) => {
        const generatePeaks = spawn("audiowaveform", [
            "-i",
            wavPath,
            "-o",
            peaksPath,
            "--pixels-per-second",
            "1",
            "--bits",
            "8",
        ]);
        generatePeaks.on("exit", function (code) {
            console.log("generate peaks exited with code " + code);
            if (code === 1 || code == 2) {
                processFailed = true;
            }
            resolve(true);
        });
    });
    await peaksDone.catch((e) => processFailed = true);
    await fs.unlink(wavPath);
    if (processFailed) {
        return false;
    }
    const normalizeDone = new Promise((resolve, reject) => {
        const normalize = spawn("python", [
            "./scripts/normalize_peaks.py",
            peaksPath,
        ]);
        normalize.on("exit", function (code) {
            console.log("normalize exited with code " + code);
            resolve(true);
        });
    });
    await normalizeDone.catch((e) => console.log(e));
    return true;
}; */

export const checkCompletion = async (
    fileId,
    state,
    externalId,
    filePath,
    language,
    uploadDir,
    userId,
    fetch
) => {
    if (language === "est2") {
        try {
            /* const result = await fetch(
              "http://bark.phon.ioc.ee/transcribe/v1/result?id=" + externalId
            ).catch(e => {
              console.log("Error fetching", "http://bark.phon.ioc.ee/transcribe/v1/result?id=" + externalId, e);
              return {done: false}
            })
            if (!result) return {done: false};
            const body: TranscriberResult = await result.json();
            if (!body.done) {
              return { done: false };
            } else if (body.error) {
              await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                  id: fileId,
                },
              });
              console.log(
                `Failed to transcribe ${fileId}. Failed with code`,
                body.error.code,
                body.error.message,
              );
              await unlink(path);
              return { done: true };
            } else if (body) {
              const path = `${uploadDir}/${fileId}.json`;
              const text = JSON.stringify(body.result);
              const writeStream = createWriteStream(path);
              writeStream.on("finish", async function () {
                await prisma.file.update({
                  data: {
                    initialTranscriptionPath: path,
                    state: "READY",
                  },
                  where: {
                    id: fileId,
                  },
                });
              });
              writeStream.write(text);
              writeStream.end();
              // Pre-generate waveform peaks
              await generatePeaks(fileId);
              return { done: true };
            } */
            return { done: false };
        }
        catch (e) {
            return { done: false }
        }
    } else if (language === "est") {
        // Retry starting transcription process
        /* if (state === "UPLOADED") {
            console.log("Retrying", filePath, RESULTS_DIR, userId, fileId)
            const result = await fetch(
                `/api/transcribe`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        fileId,
                        filePath,
                        resultDir: path.join(RESULTS_DIR, userId, fileId, "result.json"),
                        workflowName: externalId,
                    })
                }
            ).catch(e => console.error("Could not start Nextflow process", e))
            if (result && result.ok) {
                const body = await result.json();
                console.log("Result nok", body)
                if (body.requestId) {
                    await prisma.file.update({
                        where: {
                            id: fileId
                        },
                        data: {
                            state: "PROCESSING"
                        }
                    }).catch(e => console.error("Could not save file PROCESSING status to DB", e))
                };
            }
            return { done: false };
        } */
        // Progress request
/*         const progressRequest = await fetch(
            `transcribe/progress/` + fileId,
        ).catch(e => {
            console.log("Transcription progress fetch error", e);
        });
        if (!progressRequest) return { done: false }
        // Request successful
        if (progressRequest.status === 200) {
            const progress = await progressRequest.json();
            // Transcription is in progress
            if (!progress.done) {
                logger.info({userId, message: `progress: ${progress.progress}, queued: ${progress.queued}`})
                return {
                    done: false,
                    fileId,
                    progress: progress.progress,
                    status: (progress.progress === 0 ? "UPLOADED" : "PROCESSING"),
                    queued: progress.queued
                };
            } // Transcription finished and succesfully
            else if (progress.done && progress.success) {
                await prisma.file.update({
                    data: {
                        state: "READY",
                    },
                    where: {
                        id: fileId,
                    },
                });
                return { done: true };
            } else if ((progress.done && !progress.success)) {
                await prisma.file.update({
                    data: { state: "PROCESSING_ERROR" },
                    where: {
                        id: fileId,
                    },
                });
                console.log(
                    `Failed to transcribe ${fileId}. Failed with code`,
                    progress.errorCode,
                    progress.errorMessage,
                );
                await unlink(filePath);
                return { done: true };
            }
        } else if (
            progressRequest.status === 400 || progressRequest.status === 404
        ) {
            const progress = await progressRequest.json();
            await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                    id: fileId,
                },
            });
            console.log(
                `Failed to transcribe ${fileId}. Failed with code`,
                progress.errorCode,
                progress.errorMessage,
            );
            await unlink(filePath);
            return { done: true };
        } // Network error, service down etc.
        else return { done: false }; */
    } else {
        const result = await fetch(FIN_ASR_RESULTS_URL, {
            method: "POST",
            body: externalId,
        }).catch(e => console.error("Post failed to", FIN_ASR_RESULTS_URL, externalId))
        const body: FinAsrResult = await result.json();
        if (!body) return { done: false };
        if (!body.done) {
            return { done: false };
        } // Error case
        else if (body.code) {
            await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                    id: fileId,
                },
            });
            console.log(
                `Failed to transcribe ${fileId}. Failed with code ${body.code,
                body.message}`,
            );
            await unlink(filePath);
            return { done: true };
        } else if (body) {
            const formatted = finToEstFormat(body);
            const path = `${uploadDir}/${fileId}.json`;
            const text = JSON.stringify(formatted);
            const writeStream = createWriteStream(path);
            writeStream.on("finish", async function () {
                await prisma.file.update({
                    data: {
                        initialTranscriptionPath: path,
                        state: "READY",
                    },
                    where: {
                        id: fileId,
                    },
                });
            });
            writeStream.write(text);
            writeStream.end();
            // Pre-generate waveform peaks
            // await generatePeaks(fileId);
            return { done: true };
        }
    }
};

export const getFiles = async (id) => {
    const user = await prisma.user.findUnique({
        where: {
            id: id
        },
        include: {
            files: {
                orderBy: {
                    uploadedAt: "desc",
                },
                select: {
                    id: true,
                    state: true,
                    text: true,
                    filename: true,
                    duration: true,
                    mimetype: true,
                    uploadedAt: true,
                    textTitle: true,
                    initialTranscription: true,
                    externalId: true,
                    path: true,
                    language: true,
                    workflows: {
                        take: 1, 
                        select: {
                            progressLength: true,
                            succeededCount: true,
                            processes: {
                                select: {
                                    status: true,
                                }
                            }
                        }
                    }
                },
            },
        },
    });
    if (user) return user.files.map(
        file => {
            let progress = -1;
            if (file.state !== "READY" && file.state !== "ABORTED" && file.state !== "PROCESSING_ERROR") {
                if (file.workflows && file.workflows.length > 0 && file.workflows[0].processes) {
                    progress = Math.floor(file.workflows[0].processes.length / 30 * 100);
                } 
            }
            return {
                id: file.id,
                state: file.state,
                text: file.text,
                filename: file.filename,
                duration: file.duration?.toNumber(),
                mimetype: file.mimetype,
                uploadedAt: file.uploadedAt?.toString(),
                textTitle: file.textTitle,
                initialTranscription: file.initialTranscription,
                externalId: file.externalId,
                path: file.path,
                language: file.language,
                userId: user.id,
                progress
            }

        }
    );
    else return [];
};
