import { prisma } from "$lib/db/client";
import { promises as fs } from 'fs';
import type { RequestHandler } from "./$types";
import { error } from '@sveltejs/kit';
import path from 'path';
import { Result } from "postcss";

export const DELETE: RequestHandler = async ({params, locals}) => {
    if (!locals.userId) {
        throw error(301, "Not authenticated user");
    }
    // Validate that the user owns the file
    const fileDetails = await prisma.file.findUnique({
        where: {
            id: params.fileId
        },
        select: {
            path: true,
            initialTranscriptionPath: true,
            User: {
                select: {
                    id: true
                }
            }
        }
    })
    if (!fileDetails || fileDetails.User.id !== locals.userId) {
        throw error(404, 'fileNotFound');
    }
    await fs.rm(fileDetails.path).catch(e => {
        console.log("Failed to remove file from disk!", e)
    })
    await prisma.file.delete({
        where: {
            id: params.fileId
        }
    }).catch(e => {
        console.log("Failed to remove file from DB!", e)
        throw error(503, 'fileNotDeleted');
    })
    console.log(`file ${params.fileId} deleted`)
    return new Response("", {status: 200})
    
}

// Save edited transcription to disk
export const PUT: RequestHandler = async ({params, request, locals}) => {
    const editorContent = await request.json()
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        },
        select: {
            initialTranscriptionPath: true,
        }
    })
    try {
      const writeStream = await fs.writeFile(file.initialTranscriptionPath, JSON.stringify(editorContent))
      return new Response('', {status: 201})
    }
    catch (err) {
        console.log(err, file.initialTranscriptionPath);
        throw error(500, "fileWriteError")
    }
}