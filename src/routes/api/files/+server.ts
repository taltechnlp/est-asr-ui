import type { RequestHandler } from "./$types";
import { error, json } from '@sveltejs/kit';
import { checkCompletion, getFiles } from "$lib/helpers/api";
import { SECRET_UPLOAD_DIR } from '$env/static/private';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.userId) {
        throw error(301, "Not authenticated user");
    }
    let files = await getFiles(locals.userId)
    const pendingFiles = files.filter((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')
    if (pendingFiles.length > 0) {
        const promises = pendingFiles.map(file => checkCompletion(file.id, file.externalId, file.path, SECRET_UPLOAD_DIR))
        const resultRetrieved = (await Promise.all(promises)).reduce((acc, x) => acc || x, false);
        if (resultRetrieved) {
            files = await getFiles(locals.userId)
        }
    }
    return json({files}, {status: 200})
}