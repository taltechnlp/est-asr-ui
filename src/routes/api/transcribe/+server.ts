import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	NEXTFLOW_PATH,
	PIPELINE_DIR,
	EST_ASR_URL,
	NEXTFLOW_PROFILE,
	ASR_BACKEND
} from '$env/static/private';
import { runNextflow } from './helpers';
import { submitRayJob } from '$lib/asr/ray';

export const POST: RequestHandler = async ({ request }) => {
	const { fileId, filePath, resultDir, workflowName, resume } = await request.json();

	if (ASR_BACKEND === 'ray') {
		const submitted = await submitRayJob(filePath);
		if (!submitted) {
			return json(
				{
					error: 'ray_not_started',
					message: 'Ray ASR server did not accept the job. Check ASR_RAY_URL.'
				},
				{ status: 500 }
			);
		}
		return json({ requestId: submitted.jobId, backend: 'ray' });
	}

	const processSpawned = runNextflow(
		fileId,
		filePath,
		workflowName,
		resultDir,
		resume,
		true,
		true,
		true,
		PIPELINE_DIR,
		NEXTFLOW_PROFILE,
		EST_ASR_URL,
		NEXTFLOW_PATH
	);
	if (!processSpawned) {
		return json(
			{
				error: 'nextflow_not_started',
				message: 'Nextflow did not start. Check PIPELINE_DIR/NEXTFLOW_PATH configuration.'
			},
			{ status: 500 }
		);
	}
	return json({ requestId: workflowName, backend: 'nextflow' });
};
