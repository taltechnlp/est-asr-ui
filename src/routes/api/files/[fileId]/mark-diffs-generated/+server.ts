import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

/**
 * POST /api/files/[fileId]/mark-diffs-generated
 *
 * Mark that diff nodes have been generated for this file's corrections
 * This prevents regenerating diffs when user reopens the file (after accepting/rejecting them)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
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

		// Mark diffs as generated
		await prisma.file.update({
			where: { id: fileId },
			data: {
				diffsGenerated: true
			}
		});

		return json({
			success: true,
			message: 'Diffs marked as generated'
		});
	} catch (error) {
		console.error('Error marking diffs as generated:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to mark diffs as generated'
			},
			{ status: 500 }
		);
	}
};
