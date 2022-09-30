import { unlink } from 'fs/promises';
import { prisma } from "$lib/db/client";
import { createWriteStream } from 'fs'
import type { TranscriberResult, FinAsrResult, FinAsrFinished, EditorContent, SectionType } from './api.d';
import { FIN_ASR_RESULTS_URL } from '$env/static/private';

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