import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

/**
 * Check if a summary exists for a file without fetching the full summary
 * This endpoint is used to avoid 404 errors in console when checking for summaries
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { fileId } = params;

		// Just check if summary exists
		const summary = await prisma.transcriptSummary.findUnique({
			where: { fileId },
			select: { id: true } // Only select ID to minimize data transfer
		});

		return json({ exists: !!summary });
	} catch (error) {
		console.error('Check summary existence error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to check summary' },
			{ status: 500 }
		);
	}
};
