import type { PageServerLoad } from './$types';
import { prisma } from "$lib/db/client";
import { error, json } from '@sveltejs/kit';

export const load = (async ({ locals, fetch }) => {
    let userId = locals.userId;
    if (!userId) {
        let session = await locals.getSession();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId ) {
        error(401, "Not authenticated user");
    }
    const files = await prisma.file.findMany({
        orderBy: {
            uploadedAt: 'desc'
        }
    })
    return { files };
}) satisfies PageServerLoad;