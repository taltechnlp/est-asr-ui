import type { PageServerLoad } from './$types';
import { prisma } from "$lib/db/client";
import { error } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    let session = await locals.auth();
    if (!session && !session.user.id  ) {
        error(401, "Not authenticated user");
    }
    const files = await prisma.file.findMany({
        orderBy: {
            uploadedAt: 'desc'
        }
    })
    return { files };
}) satisfies PageServerLoad;