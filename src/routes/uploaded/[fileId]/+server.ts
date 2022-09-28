import { prisma } from "$lib/db/client";
import { error } from '@sveltejs/kit'; 
import type {RequestHandler} from './$types';
import { promises as fs } from 'fs';
import { SECRET_AUDIO_UPLOAD_DIR } from '$env/static/private';
import path from 'path'

// Return the audio or video file for playback. Authorization requried.
export const GET: RequestHandler = async ({ params, locals }) => {
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        }
    })
    if (locals.userId && locals.userId === file.uploader) {
        let location = file.path;
        if (location.charAt[0] !== '/') {
            location = path.join(SECRET_AUDIO_UPLOAD_DIR, location)
        }
        const data = await fs.readFile(location)
        return new Response(data);
    }
    throw error(401, 'unauthorized'); 
}