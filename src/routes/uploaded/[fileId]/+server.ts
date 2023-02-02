import { prisma } from "$lib/db/client";
import { error } from '@sveltejs/kit'; 
import type {RequestHandler} from './$types';
import { promises as fs, createReadStream, statSync } from 'fs';
import { SECRET_AUDIO_UPLOAD_DIR } from '$env/static/private';
import path from 'path'

function readRangeHeader(range, totalLength) {
    /*
     * Example of the method 'split' with regular expression.
     * 
     * Input: bytes=100-200
     * Output: [null, 100, 200, null]
     * 
     * Input: bytes=-200
     * Output: [null, null, 200, null]
     */

    if (range == null || range.length == 0)
        return null;

    var array = range.split(/bytes=([0-9]*)-([0-9]*)/);
    var start = parseInt(array[1]);
    var end = parseInt(array[2]);
    var result = {
        start: isNaN(start) ? 0 : start,
        end: isNaN(end) ? (totalLength - 1) : end
    };

    if (!isNaN(start) && isNaN(end)) {
        result.start = start;
        result.end = totalLength - 1;
    }

    if (isNaN(start) && !isNaN(end)) {
        result.start = totalLength - end;
        result.end = totalLength - 1;
    }

    return result;
}


// Return the audio or video file for playback. Authorization requried.
export const GET: RequestHandler = async ({ params, locals, request }) => {
    const range = request.headers.get('Range');
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        }
    })
    const isAdmin =
      await (await prisma.user.findUnique({ where: { id: locals.userId } }))
        .role === "ADMIN";
    if (locals.userId && (locals.userId === file.uploader || isAdmin)) {
        let location = file.path;
        if (location[0] !== '/') {
            location = path.join(SECRET_AUDIO_UPLOAD_DIR, location)
        }
        const stat = statSync(location);
        const ranges = readRangeHeader(range, stat.size);
        const stream = createReadStream(location, { start: ranges.start, end: ranges.end })
        // @ts-ignore
        return new Response(stream);
    }
    throw error(401, 'unauthorized'); 
}