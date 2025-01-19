import type { RequestHandler } from "./$types";
import { json } from '@sveltejs/kit';
import { NEXTFLOW_PATH, PIPELINE_DIR, EST_ASR_URL, RESULTS_DIR, NEXTFLOW_PROFILE } from '$env/static/private';
import path from "path";
import { runNextflow } from "./helpers";


export const POST: RequestHandler = async ({ request }) => {
    const {fileId, filePath, resultDir, workflowName, resume} = await request.json();
    const processSpawned = runNextflow(fileId, filePath, workflowName, resultDir, true, true, true, PIPELINE_DIR, NEXTFLOW_PROFILE, EST_ASR_URL, NEXTFLOW_PATH, resume);
    return json( { requestId: workflowName } );
}