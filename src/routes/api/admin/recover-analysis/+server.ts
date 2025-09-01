import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';
import { z } from 'zod';

const RecoverAnalysisSchema = z.object({
	fileId: z.string(),
	force: z.boolean().optional().default(false)
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse and validate request
		const body = await request.json();
		const { fileId, force } = RecoverAnalysisSchema.parse(body);

		// Check authentication - admin only
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// For now, allow any authenticated user - in production you might want admin-only
		// if (session.user.role !== 'ADMIN') {
		// 	return json({ error: 'Admin access required' }, { status: 403 });
		// }

		// Get file to check if it exists and needs recovery
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				filename: true,
				state: true,
				autoAnalyze: true,
				uploader: true,
				transcriptCorrections: {
					select: {
						blockIndex: true,
						status: true
					},
					orderBy: { blockIndex: 'asc' }
				}
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Check if user has access to this file
		if (file.uploader !== session.user.id) {
			return json({ error: 'Access denied - you can only recover your own files' }, { status: 403 });
		}

		if (file.state !== 'READY') {
			return json({ error: 'File must be in READY state for analysis recovery' }, { status: 400 });
		}

		// Count completed vs total expected blocks
		const completedBlocks = file.transcriptCorrections.filter(tc => tc.status === 'completed').length;
		const totalBlocks = Math.max(1, file.transcriptCorrections.length);
		const hasIncomplete = file.transcriptCorrections.some(tc => tc.status !== 'completed');

		console.log(`[RECOVERY] File ${file.filename} analysis status: ${completedBlocks}/${totalBlocks} blocks completed, hasIncomplete: ${hasIncomplete}`);

		// If analysis appears complete and not forcing, return current status
		if (!hasIncomplete && !force) {
			return json({
				success: true,
				message: 'Analysis appears to be complete',
				fileId,
				filename: file.filename,
				completedBlocks,
				totalBlocks,
				needsRecovery: false
			});
		}

		// Trigger analysis recovery by calling auto-analyze
		try {
			console.log(`[RECOVERY] Triggering analysis recovery for file: ${file.filename} (${fileId})`);

			const response = await fetch(`${request.url.origin}/api/transcript-analysis/auto-analyze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fileId })
			});

			if (response.ok) {
				const result = await response.json();
				console.log(`[RECOVERY] Analysis recovery completed for file: ${file.filename}`);

				return json({
					success: true,
					message: 'Analysis recovery initiated successfully',
					fileId,
					filename: file.filename,
					recoveryResult: result,
					needsRecovery: true
				});
			} else {
				const errorText = await response.text();
				console.error(`[RECOVERY] Analysis recovery failed for file: ${file.filename} - ${response.status}: ${errorText}`);
				
				return json({
					error: `Recovery failed: ${errorText}`,
					fileId,
					filename: file.filename,
					completedBlocks,
					totalBlocks
				}, { status: 500 });
			}
		} catch (error) {
			console.error(`[RECOVERY] Analysis recovery error for file: ${file.filename}:`, error);
			
			return json({
				error: `Recovery error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				fileId,
				filename: file.filename,
				completedBlocks,
				totalBlocks
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Recovery endpoint error:', error);
		
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const fileId = url.searchParams.get('fileId');

		if (!fileId) {
			return json({ error: 'fileId parameter required' }, { status: 400 });
		}

		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Get analysis status for the file
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				filename: true,
				state: true,
				autoAnalyze: true,
				uploader: true,
				transcriptCorrections: {
					select: {
						blockIndex: true,
						status: true,
						processingTimeMs: true,
						createdAt: true,
						updatedAt: true
					},
					orderBy: { blockIndex: 'asc' }
				}
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Check access
		if (file.uploader !== session.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		const completedBlocks = file.transcriptCorrections.filter(tc => tc.status === 'completed');
		const errorBlocks = file.transcriptCorrections.filter(tc => tc.status === 'error');
		const pendingBlocks = file.transcriptCorrections.filter(tc => tc.status === 'pending');

		return json({
			fileId: file.id,
			filename: file.filename,
			state: file.state,
			autoAnalyze: file.autoAnalyze,
			analysis: {
				totalBlocks: file.transcriptCorrections.length,
				completedBlocks: completedBlocks.length,
				errorBlocks: errorBlocks.length,
				pendingBlocks: pendingBlocks.length,
				isComplete: completedBlocks.length > 0 && errorBlocks.length === 0 && pendingBlocks.length === 0,
				needsRecovery: errorBlocks.length > 0 || (pendingBlocks.length > 0 && file.transcriptCorrections.length > 0),
				corrections: file.transcriptCorrections.map(tc => ({
					blockIndex: tc.blockIndex,
					status: tc.status,
					processingTimeMs: tc.processingTimeMs,
					createdAt: tc.createdAt,
					updatedAt: tc.updatedAt
				}))
			}
		});
	} catch (error) {
		console.error('Recovery status endpoint error:', error);
		
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};