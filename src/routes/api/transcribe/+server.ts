import type { RequestHandler } from "./$types";
import { json } from '@sveltejs/kit';
import { NEXTFLOW_PATH, PIPELINE_DIR, EST_ASR_URL, RESULTS_DIR } from '$env/static/private';
import path from "path";
import { runNextflow } from "./helpers";


export const POST: RequestHandler = async ({ request }) => {
    const {filePath, resultDir, workflowName} = await request.json();
    const processSpawned = runNextflow(filePath, workflowName, resultDir, true, true, true, PIPELINE_DIR, EST_ASR_URL, NEXTFLOW_PATH, false);
    return json( { requestId: workflowName } );
}