import type { RequestHandler } from "./$types";
import type { File, Prisma } from "@prisma/client";
import { error, json } from '@sveltejs/kit';
import { checkCompletion, getFiles } from "$lib/helpers/api";
import { SECRET_UPLOAD_DIR } from '$env/static/private';

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
    progressPrc?: number;
    totalJobsQueued?: number;
    totalJobsStarted?: number;
}

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.userId) {
        throw error(301, "Not authenticated user");
    }
    let files: FileWithProgress[] = await getFiles(locals.userId)
    const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')
    if (pendingFiles.length > 0) {
        const promises = pendingFiles.map(file => checkCompletion(file.id, file.externalId, file.path, file.language, SECRET_UPLOAD_DIR))
        const resultRetrieved = (await Promise.all(promises)).reduce((acc, x) => {
            if (!x.done && x.fileId && x.progressPrc) {
                const index = files.findIndex(file => file.id === x.fileId);
                files[index].progressPrc = x.progressPrc;
                files[index].state = x.status;
                files[index].totalJobsQueued = x.totalJobsQueued;
                files[index].totalJobsStarted = x.totalJobsStarted;
            }
            return acc || x.done
        }, false);
        if (resultRetrieved) {
            files = await getFiles(locals.userId)
        }
    }
    return json({files}, {status: 200})
}