import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

/**
 * GET /api/files/[fileId]/corrections
 *
 * Load all transcript corrections for a file
 * Returns correction blocks with alignments that can be used to create diff nodes
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const { fileId } = params;

		// Check authentication
		const session = await locals.auth();
		if (!session || !session.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Verify file ownership
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				uploader: true
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		if (file.uploader !== session.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Load all corrections for this file
		const corrections = await prisma.transcriptCorrection.findMany({
			where: {
				fileId,
				status: 'completed' // Only load completed corrections
			},
			orderBy: {
				blockIndex: 'asc'
			},
			select: {
				id: true,
				fileId: true,
				blockIndex: true,
				segmentIndices: true,
				originalText: true,
				correctedText: true,
				suggestions: true,
				status: true,
				createdAt: true,
				updatedAt: true
			}
		});

		return json({
			success: true,
			corrections,
			count: corrections.length
		});
	} catch (error) {
		console.error('Error loading corrections:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to load corrections'
			},
			{ status: 500 }
		);
	}
};
