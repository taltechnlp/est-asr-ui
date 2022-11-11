import { unlink } from 'fs/promises';
import { prisma } from "$lib/db/client";
import { createWriteStream } from 'fs'
import type { TranscriberResult, FinAsrResult, FinAsrFinished, EditorContent, SectionType } from './api.d';
import { FIN_ASR_RESULTS_URL } from '$env/static/private';
import { spawn } from "child_process";

let finToEstFormat: (sucRes: FinAsrFinished) => EditorContent = 
    function (sucRes: FinAsrFinished) {
        const result = {
                speakers: {
                    S1: {
                        name: "S1"
                    }
                },
                sections: [{
                    start: 0,
                    end: 0,
                    type: "non-speech" as SectionType,
                }]
            };
        if (sucRes.result.sections.length > 0) {
            result.sections = sucRes.result.sections.map(
                seg => {
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
                            words: seg.words.map(w => {return {
                                confidence: 1,
                                start: w.start + seg.start,
                                end: w.end + seg.start,
                                punctuation: "",
                                word: w.word,
                                word_with_punctuation: w.word,
                            }})
                        }]
                    }
                }
            )
        }

        return result;
    }
export const generatePeaks = async (fileId) => { 
    const file = await prisma.file.findUnique({
        where: {
            id: fileId
        }
    })
    let processFailed = false;
    let peaksPath = file.path + '.json';
    const peaksDone = new Promise((resolve, reject) => {
        const generatePeaks = spawn('audiowaveform', ['-i', file.path, '-o', peaksPath, '--pixels-per-second', '20', '--bits', '8']);
        generatePeaks.on('exit', function (code) {
            console.log('generate peaks exited with code ' + code);
            if (code === 1 || code == 2) {
                processFailed = true;
            }
            resolve(true);
        })
    })
    await peaksDone.catch(e => processFailed = true);
    if (processFailed) {
        return false;
    }
    const normalizeDone = new Promise((resolve, reject) => {
        const normalize = spawn('python', ['./scripts/normalize_peaks.py', peaksPath]);
        normalize.on('exit', function (code) {
            console.log('normalize exited with code ' + code);
            resolve(true);
        })
    })
    await normalizeDone.catch(e => console.log(e))
    return true;  
}

export const checkCompletion = async (fileId, externalId, path, language, uploadDir) => {
    if (language == 'est') {
        const result = await fetch("http://bark.phon.ioc.ee/transcribe/v1/result?id=" + externalId);
        const body: TranscriberResult = await result.json();
        if (!body.done) {
            return false;
        }
        else if (body.error) {
            await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                    id: fileId
                }
            });
            console.log(
                `Failed to transcribe ${fileId}. Failed with code`,
                body.error.code,
                body.error.message
            );
            await unlink(path);
            return true;
        } else {
            const path = `${uploadDir}/${fileId}.json`;
            const text = JSON.stringify(body.result);
            const writeStream = createWriteStream(path);
            writeStream.on("finish", async function () {
                await prisma.file.update({
                    data: {
                        initialTranscriptionPath: path,
                        state: "READY"
                    },
                    where: {
                        id: fileId
                    }
                });
            });
            writeStream.write(text);
            writeStream.end();
            // Pre-generate waveform peaks 
            await generatePeaks(fileId);
        }
        return true;
    } else {
        const result = await fetch(FIN_ASR_RESULTS_URL, {
            method: "POST",
            body: externalId
        });
        const body: FinAsrResult = await result.json();
        if (!body.done) {
            return false;
        }
        // Error case
        else if (body.code) {
            await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                    id: fileId
                }
            });
            console.log(
                `Failed to transcribe ${fileId}. Failed with code ${body.code, body.message}`
            );
            await unlink(path);
            return true;
        } else {
            const formatted = finToEstFormat(body)
            const path = `${uploadDir}/${fileId}.json`;
            const text = JSON.stringify(formatted);
            const writeStream = createWriteStream(path);
            writeStream.on("finish", async function () {
                await prisma.file.update({
                    data: {
                        initialTranscriptionPath: path,
                        state: "READY"
                    },
                    where: {
                        id: fileId
                    }
                });
            });
            writeStream.write(text);
            writeStream.end();
            // Pre-generate waveform peaks 
            await generatePeaks(fileId);
        }
        return true;
    }
}

export const getFiles = async (userId) => {
    const { files } = await prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        files: {
            orderBy: {
                uploadedAt: 'desc',
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
                language: true
            }
        }
      }
    })
    return files;
  }