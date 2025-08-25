import type { RequestHandler } from './$types';
import { z } from 'zod';
import type { ToolProgress } from '$lib/agents/tools/toolMetadata';

// Store for active analysis progress
const activeAnalysis = new Map<
	string,
	{
		progress: ToolProgress[];
		controller: ReadableStreamDefaultController;
	}
>();

const ProgressUpdateSchema = z.object({
	fileId: z.string(),
	segmentIndex: z.number(),
	toolId: z.string(),
	status: z.enum(['pending', 'running', 'completed', 'error', 'skipped']),
	startTime: z.number().optional(),
	endTime: z.number().optional(),
	error: z.string().optional()
});

// SSE endpoint for progress updates
export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const fileId = url.searchParams.get('fileId');
	const segmentIndex = url.searchParams.get('segmentIndex');

	if (!fileId || !segmentIndex) {
		return new Response('Missing parameters', { status: 400 });
	}

	const key = `${fileId}-${segmentIndex}`;

	const stream = new ReadableStream({
		start(controller) {
			// Store the controller for this connection
			activeAnalysis.set(key, {
				progress: [],
				controller
			});

			// Send initial connection message
			controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
		},
		cancel() {
			// Clean up when client disconnects
			activeAnalysis.delete(key);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};

// Endpoint to update progress (called by the agent)
export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const body = await request.json();
	const update = ProgressUpdateSchema.parse(body);

	const key = `${update.fileId}-${update.segmentIndex}`;
	const analysis = activeAnalysis.get(key);

	if (analysis) {
		// Update progress
		const existingIndex = analysis.progress.findIndex((p) => p.toolId === update.toolId);
		const progressUpdate: ToolProgress = {
			toolId: update.toolId,
			status: update.status,
			startTime: update.startTime,
			endTime: update.endTime,
			error: update.error
		};

		if (existingIndex >= 0) {
			analysis.progress[existingIndex] = progressUpdate;
		} else {
			analysis.progress.push(progressUpdate);
		}

		// Send update to client
		try {
			analysis.controller.enqueue(
				`data: ${JSON.stringify({
					type: 'progress',
					tool: progressUpdate
				})}\n\n`
			);
		} catch (e) {
			// Client might have disconnected
			activeAnalysis.delete(key);
		}
	}

	return new Response('OK');
};

// Note: Progress sending utility has been moved to a separate file to comply with SvelteKit export restrictions
