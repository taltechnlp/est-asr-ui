import type { RequestHandler } from "./$types";
import { error, json } from '@sveltejs/kit';
import { getFiles } from "$lib/helpers/api";

export const GET: RequestHandler = async ({ locals }) => {
    let session = await locals.auth();
    if (!session.user.id ) {
        error(401, "Not authenticated user");
    }
    try {
        let files = await getFiles(session.user.id);
        return json(files, {status: 200})
    }
    catch(error) {
        console.log("Fetching files failed", error);
        return json([], {status: 200})
    }
}