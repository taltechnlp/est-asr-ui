import { prisma } from "$lib/db/client";
import type { PageServerLoad } from './$types';
import { promises as fs } from 'fs';
import { error } from '@sveltejs/kit';
import type { Action } from "./$types";

export const load: PageServerLoad =  async ({ params, locals, url }) => {
	const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        }
    })
    if (locals.userId && locals.userId === file.uploader) {
        const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');
        
        // const file = await getFile(params.fileId);
        return { file: {
            id: file.id,
            state: file.state,
            content: content,
            path: file.path,
        },
        url: url.origin
     };
    }
    throw error(401, 'unauthorized'); 

}