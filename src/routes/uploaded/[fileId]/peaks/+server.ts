import { prisma } from '$lib/db/client';
import { error } from '@sveltejs/kit';
import { promises as fs } from 'fs';
import { ensurePeaks } from '$lib/server/peaks';
import type { RequestHandler } from './$types';

// Serve precomputed waveform peaks (audiowaveform binary .dat) for peaks.js.
export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session || !session.user.id) {
		error(401, 'unauthorized');
	}
	const file = await prisma.file.findUnique({
		where: { id: params.fileId },
		select: { path: true, User: { select: { id: true } } }
	});
	if (!file) error(404);
	if (file.User?.id !== session.user.id) error(401, 'unauthorized');

	let peaksPath: string;
	try {
		peaksPath = await ensurePeaks(file.path);
	} catch (err) {
		console.error(`Peaks generation failed for ${params.fileId}:`, err);
		error(503, 'peaksUnavailable');
	}

	const data = await fs.readFile(peaksPath);
	return new Response(data, {
		status: 200,
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Length': data.byteLength.toString(),
			'Cache-Control': 'private, max-age=86400'
		}
	});
};
