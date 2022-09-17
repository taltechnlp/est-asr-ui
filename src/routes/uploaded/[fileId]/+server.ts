import { prisma } from "$lib/db/client";
import { error } from '@sveltejs/kit'; 
import type {RequestHandler} from './$types';
import { promises as fs } from 'fs';

// Return the audio or video file for playback. Authorization requried.
export const GET: RequestHandler = async ({ params, locals }) => {
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        }
    })
    if (locals.userId && locals.userId === file.uploader) {
        const data = await fs.readFile(file.path)
        return new Response(data);
    }
    throw error(401, 'unauthorized'); 
}