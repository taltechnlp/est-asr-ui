import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { fileId } = params;

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

		// Get all analyzed segments
		const segments = await prisma.analysisSegment.findMany({
			where: { fileId },
			orderBy: { segmentIndex: 'asc' }
		});

		return json(segments);
	} catch (error) {
		console.error('Get segments error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to get segments' },
			{ status: 500 }
		);
	}
};
