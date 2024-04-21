import type { RequestHandler } from "./$types";
import type { File, Prisma } from "@prisma/client";
import { error, json } from '@sveltejs/kit';
import { checkCompletion, getFiles } from "$lib/helpers/api";
import { SECRET_UPLOAD_DIR } from '$env/static/private';
import { prisma } from "$lib/db/client";

type FileWithProgress = {
    uploadedAt: Date;
    id: string;
    state: string;
    text: string | null;
    path: string;
    filename: string;
    language: string;
    duration: Prisma.Decimal | null;
    mimetype: string;
    externalId: string;
    textTitle: string | null;
    initialTranscription: string | null;
    progress?: number;
    queued?: number;
}

export const GET: RequestHandler = async ({ locals, fetch, url }) => {
    let userId = locals.userId;
    if (!userId) {
        let session = await locals.getSession();
        if (session && session.user) userId = session.user.id;
    }
    if (!userId ) {
        throw error(401, "Not authenticated user");
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
    let files = await getFiles(userId)
    const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')
    if (pendingFiles.length > 0) {
        const promises = pendingFiles.map(file => checkCompletion(file.id, file.state, file.externalId, file.path, file.language, SECRET_UPLOAD_DIR, file.userId, fetch))
        const resultRetrieved = (await Promise.all(promises)).reduce((acc, x) => {
            if (!x.done && x.fileId && x.progress) {
                const index = files.findIndex(file => file.id === x.fileId);
                files[index].progress = x.progress;
                files[index].state = x.status;
                files[index].queued = x.queued;
            }
            return acc || x.done
        }, false);
        if (resultRetrieved) {
            files = await getFiles(userId)
        }
    }
    return json(files, {status: 200})
}