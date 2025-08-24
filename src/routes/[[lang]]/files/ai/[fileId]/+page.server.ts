import { prisma } from "$lib/db/client";
import type { PageServerLoad } from './$types';
import { promises as fs } from 'fs';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, url }) => {
    const file = await prisma.file.findUnique({
        where: {
            id: params.fileId
        },
        include: {
            User: {
                select: {
                    id: true,
                    email: true
                }
            }
        }
    })
    const session = await locals.auth();
    if (!session || !session.user.id) {
        error(401, 'unauthorized');
    } 
    if (!file || session.user.id !== file.User.id ) {
        return error(401, 'unauthorized');
    }

    // Return only lightweight metadata for SSR; fetch transcript separately on client
    return {
        file: {
            id: file.id,
            state: file.state,
            // content intentionally omitted for progressive loading
            path: file.path,
            name: file.filename,
            uploadedAt: file.uploadedAt,
            text: file.text,
            language: file.language
        },
        url: url.origin,
    }
}
