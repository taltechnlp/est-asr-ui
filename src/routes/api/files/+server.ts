import type { RequestHandler } from "./$types";
import type { File, Prisma } from "@prisma/client";
import { error, json } from '@sveltejs/kit';
import { getFiles } from "$lib/helpers/api";
import { prisma } from "$lib/db/client";

export const GET: RequestHandler = async ({ locals, url }) => {
    let userId = locals.userId;
    if (!userId) {
        let session = await locals.auth();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId ) {
        error(401, "Not authenticated user");
    }
    const isAdmin = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            role: true
        }
    })
    if (isAdmin && url.searchParams.has("userId")) {
        userId = url.searchParams.get("userId");
    }
    try {
        let files = await getFiles(userId);
        return json(files, {status: 200})
    }
    catch(error) {
        console.log("Fetching files failed", error);
        return json([], {status: 200})
    }
}