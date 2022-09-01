import { prisma } from "$lib/db/client";
import { promises as fs } from 'fs';
import type { RequestHandler } from "./$types";
import { error } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({params, locals}) => {
    // Validate that the user owns the file
    const fileDetails = await prisma.file.findUnique({
        where: {
            id: params.fileId
        },
        select: {
            path: true,
            User: {
                select: {
                    id: true
                }
            }
        }
    })
    if (fileDetails.User.id !== locals.userId) {
        throw error(404, 'fileNotFound');
    }
    const removeFile = await fs.rm(fileDetails.path).catch(e => {
        console.log("Failed to remove file from disk!", e)
    })
    const removeFromDB = await prisma.file.delete({
        where: {
            id: params.fileId
        }
    }).catch(e => {
        console.log("Failed to remove file from DB!", e)
        throw error(503, 'fileNotDeleted');
    })
    console.log(`file ${params.fileId} deleted`)
    return new Response("", {status: 200, statusText: "OK"})
    
}