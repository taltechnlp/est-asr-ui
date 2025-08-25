import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { fileId, segmentIndex } = params;
		const segmentIndexNum = parseInt(segmentIndex, 10);

		if (isNaN(segmentIndexNum)) {
			return json({ error: 'Invalid segment index' }, { status: 400 });
		}

		// Verify file ownership
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: { uploader: true }
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		if (file.uploader !== session.user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Delete the analysis segment
		const deletedSegment = await prisma.analysisSegment.delete({
			where: {
				fileId_segmentIndex: {
					fileId,
					segmentIndex: segmentIndexNum
				}
			}
		});

		return json({
			success: true,
			deletedSegment: {
				fileId: deletedSegment.fileId,
				segmentIndex: deletedSegment.segmentIndex
			}
		});
	} catch (error) {
		console.error('Delete segment analysis error:', error);

		// Handle case where segment doesn't exist
		if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
			return json({ error: 'Analysis segment not found' }, { status: 404 });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Failed to delete segment analysis' },
			{ status: 500 }
		);
	}
};
