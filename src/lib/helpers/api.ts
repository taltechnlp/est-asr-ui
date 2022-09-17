import axios from 'axios';
import { unlink } from 'fs/promises';
import { prisma } from "$lib/db/client";
import { createWriteStream } from 'fs'
import type { TranscriberResult } from './api.d'

export const checkCompletion = async (fileId, externalId, path, uploadDir) => {
    // console.log(fileId, externalId, path)
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
            path: true
          }
        }
      }
    })
    return files;
  }