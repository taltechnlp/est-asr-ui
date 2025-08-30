import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import {
	exportWithSuggestionsApplied,
	exportWithCorrectedSegments,
	exportWithWERCorrections,
	generateExportReport
} from '$lib/services/benchmarkExporter';
import { promises as fs } from 'fs';
import path from 'path';

const BenchmarkExportSchema = z.object({
	fileId: z.string(),
	minConfidence: z.number().min(0).max(1).optional().default(0.0),
	applyAll: z.boolean().optional().default(true),
	includeReport: z.boolean().optional().default(false)
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse and validate request
		const body = await request.json();
		const { fileId, minConfidence, applyAll, includeReport } = BenchmarkExportSchema.parse(body);

		// Get file and check ownership/access
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				uploader: true,
				state: true,
				autoAnalyze: true,
				initialTranscription: true,
				initialTranscriptionPath: true,
				text: true,
				filename: true
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Check authentication
		const session = await locals.auth();
		if (!session?.user) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}

		// Verify ownership
		if (file.uploader !== session.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Check if file is ready and has auto-analysis enabled
		if (file.state !== 'READY') {
			return json({ error: 'File not ready for export' }, { status: 400 });
		}

		if (!file.autoAnalyze) {
			return json({ error: 'File does not have auto-analysis enabled' }, { status: 400 });
		}

		// Get transcript content
		let transcriptContent = null;
		try {
			if (file.initialTranscriptionPath) {
				transcriptContent = await fs.readFile(file.initialTranscriptionPath, 'utf8');
			} else if (file.text) {
				transcriptContent = file.text;
			} else if (file.initialTranscription) {
				transcriptContent = file.initialTranscription;
			}
		} catch (error) {
			console.error('Failed to read transcript content:', error);
		}

		if (!transcriptContent) {
			return json({ error: 'Transcript content not available' }, { status: 400 });
		}

		// Parse transcript content
		let parsedContent;
		try {
			parsedContent = JSON.parse(transcriptContent);
		} catch (error) {
			// If JSON parsing fails, treat as plain text
			parsedContent = transcriptContent;
		}

		// Check for WER corrections first (highest priority)  
		console.log(`[Apply&Export] Querying for fileId: ${fileId}`);
		const werCorrections = await prisma.transcriptCorrection.findMany({
			where: { fileId },
			orderBy: { blockIndex: 'asc' }
		});
		console.log(`[Apply&Export] Found ${werCorrections.length} WER corrections`);

		let exportResult;
		let exportMethod = 'suggestion application'; // default

		if (werCorrections.length > 0) {
			// Use WER corrections if available
			exportMethod = 'WER corrections';
			console.log(`Using WER corrections: ${werCorrections.length} blocks found`);
			exportResult = exportWithWERCorrections(werCorrections);
		} else {
			// Fallback to existing logic for backward compatibility
			console.log(`[Apply&Export] Querying analysis segments for fileId: ${fileId}`);
			const analysisSegments = await prisma.analysisSegment.findMany({
				where: {
					fileId,
					status: 'analyzed'
				},
				orderBy: { segmentIndex: 'asc' }
			});
			console.log(`[Apply&Export] Found ${analysisSegments.length} analyzed segments`);

			if (analysisSegments.length === 0) {
				return json(
					{
						error: 'No corrections or analyzed segments found. Please run analysis first.'
					},
					{ status: 400 }
				);
			}

			console.log(
				`Processing benchmark export for file ${fileId}: ${analysisSegments.length} segments`
			);

			// Check if we have corrected segments available
			const segmentsWithCorrectedText = analysisSegments.filter((seg) => seg.correctedSegment);
			const useCorrectedSegments = segmentsWithCorrectedText.length > 0;

			exportMethod = useCorrectedSegments ? 'corrected segments' : 'suggestion application';
			console.log(`Export method: ${exportMethod}`);
			console.log(
				`Corrected segments available: ${segmentsWithCorrectedText.length}/${analysisSegments.length}`
			);

			// Choose export method based on availability of corrected segments
			exportResult = useCorrectedSegments
				? exportWithCorrectedSegments(parsedContent, analysisSegments)
				: exportWithSuggestionsApplied(parsedContent, analysisSegments, {
						minConfidence,
						applyAll,
						includeStats: true
					});
		}

		if (!exportResult.success) {
			console.error('Benchmark export failed:', exportResult.error);
			return json(
				{
					error: `Export failed: ${exportResult.error}`,
					stats: exportResult.exportStats
				},
				{ status: 500 }
			);
		}

		// Generate safe filename
		const safeFileName = (file.filename || 'transcript')
			.replace(/[^a-zA-Z0-9.-]/g, '_')
			.replace(/_+/g, '_');

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const fileName = `${safeFileName}_corrected_${timestamp}.txt`;

		console.log('Benchmark export successful:', {
			fileName,
			method: exportMethod,
			stats: exportResult.exportStats,
			textLength: exportResult.plainText?.length
		});

		// Prepare response
		const response: any = {
			success: true,
			fileName,
			stats: exportResult.exportStats,
			plainText: exportResult.plainText
		};

		if (includeReport) {
			response.report = generateExportReport(exportResult);
			response.segmentDetails = exportResult.segmentDetails;
		}

		return json(response);
	} catch (error) {
		console.error('Benchmark export API error:', error);

		if (error instanceof z.ZodError) {
			return json(
				{
					error: 'Invalid request parameters',
					details: error.errors
				},
				{ status: 400 }
			);
		}

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

		// Get file info and analysis status
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				uploader: true,
				state: true,
				autoAnalyze: true,
				filename: true,
				analysisSegments: {
					select: {
						segmentIndex: true,
						status: true
					}
				},
				transcriptCorrections: {
					select: {
						blockIndex: true,
						status: true
					}
				}
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Verify ownership
		if (file.uploader !== session.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		// Check WER corrections status
		const werCorrections = file.transcriptCorrections || [];
		const completedWERBlocks = werCorrections.filter((tc) => tc.status === 'completed');
		const hasWERCorrections = completedWERBlocks.length > 0;

		// Fallback to analysis segments
		const analyzedSegments = file.analysisSegments.filter((seg) => seg.status === 'analyzed');
		const totalSegments = file.analysisSegments.length;

		// Can export if we have WER corrections OR analyzed segments
		const canExport =
			file.state === 'READY' &&
			(hasWERCorrections || (file.autoAnalyze && analyzedSegments.length > 0));

		return json({
			fileId: file.id,
			fileName: file.filename,
			state: file.state,
			autoAnalyze: file.autoAnalyze,
			canExport,
			werCorrections: {
				totalBlocks: werCorrections.length,
				completedBlocks: completedWERBlocks.length,
				hasCorrections: hasWERCorrections
			},
			analysisStatus: {
				totalSegments,
				analyzedSegments: analyzedSegments.length,
				pendingSegments: totalSegments - analyzedSegments.length,
				isComplete: analyzedSegments.length === totalSegments && totalSegments > 0
			}
		});
	} catch (error) {
		console.error('Benchmark export status API error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
