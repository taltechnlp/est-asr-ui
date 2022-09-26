import axios from 'axios';
import { unlink } from 'fs/promises';
import { prisma } from "$lib/db/client";
import { createWriteStream } from 'fs'
import type { TranscriberResult, FinAsrResult, FinSegment } from './api.d';
import { FIN_ASR_RESULTS_URL } from '$env/static/private';

const finToEstFormat = (segments: Array<FinSegment>) => {
    return {
        speakers: {},
        sections: segments.map(seg => {return {
            "start": seg.start,
            end: seg.stop,
            speaker: "",
            type: "speech",
            turns: seg.responses.map(part => {return {
                confidence: part.confidence
            }})
        }})
    }
}

export const checkCompletion = async (fileId, externalId, path, language, uploadDir) => {
    // console.log(fileId, externalId, path)
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
        if (body.status === "pending") {
            return false;
        }
        // Undocumented error case
        else if (body.status !== "done") {
            await prisma.file.update({
                data: { state: "PROCESSING_ERROR" },
                where: {
                    id: fileId
                }
            });
            console.log(
                `Failed to transcribe ${fileId}. Failed with code`
            );
            await unlink(path);
            return true;
        } // Finished successfully
        else {
            const path = `${uploadDir}/${fileId}.json`;
            const text = JSON.stringify(body.segments);
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