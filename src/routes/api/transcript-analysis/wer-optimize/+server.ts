import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import { extractWordsFromEditor } from '$lib/utils/extractWordsFromEditor';
import { fromNewEstFormatAI } from '$lib/helpers/converters/newEstFormatAI';
import { getCoordinatingAgentWER } from '$lib/agents/coordinatingAgentWER';
import { getSummaryGenerator } from '$lib/agents/summaryGenerator';
import { isNewFormat } from '$lib/helpers/converters/newEstFormat';
import type { TranscriptionResult } from '$lib/helpers/api.d';
import { promises as fs } from 'fs';
import { getAgentFileLogger } from '$lib/utils/agentFileLogger';

const WEROptimizeSchema = z.object({
	fileId: z.string(),
	modelName: z.string().optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse and validate request
		const body = await request.json();
		const { fileId, modelName } = WEROptimizeSchema.parse(body);

		// Get file first to check ownership
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				uploader: true,
				state: true,
				initialTranscription: true,
				initialTranscriptionPath: true,
				text: true,
				language: true,
				path: true,
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

		if (file.state !== 'READY') {
			return json({ error: 'File not ready for analysis' }, { status: 400 });
		}

		// Check if WER analysis is already in progress
		const existingCorrections = await prisma.transcriptCorrection.findMany({
			where: { fileId },
			select: { blockIndex: true, status: true }
		});

		const inProgress = existingCorrections.some((tc) => tc.status === 'processing');
		if (inProgress) {
			return json({ error: 'WER analysis already in progress for this file' }, { status: 409 });
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

		// Convert to TipTap format if needed
		let editorContent;
		if (typeof parsedContent === 'string') {
			// Plain text - need to convert to TipTap format
			editorContent = {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [
							{
								type: 'text',
								text: parsedContent
							}
						]
					}
				]
			};
		} else if (isNewFormat(parsedContent)) {
			// New EST format - convert to TipTap
			const result = fromNewEstFormatAI(parsedContent as TranscriptionResult);
			editorContent = result.editorContent;
		} else {
			// Assume it's already TipTap format
			editorContent = parsedContent;
		}

		// Initialize logger
		const transcriptPath = file.initialTranscriptionPath || `/tmp/${file.id}.transcript`;
		const logger = getAgentFileLogger(transcriptPath, file.id);

		// Get or create transcript summary
		let summary;
		const existingSummary = await prisma.transcriptSummary.findUnique({
			where: { fileId }
		});

		if (existingSummary) {
			summary = existingSummary;
			await logger.logGeneral('info', 'Using existing transcript summary', {
				summaryLength: summary.summary.length
			});
		} else {
			// Generate summary
			await logger.logGeneral('info', 'Generating transcript summary for WER analysis');

			const summaryGenerator = getSummaryGenerator();
			summary = await summaryGenerator.generateSummary({
				fileId,
				editorContent,
				language: file.language,
				uiLanguage: 'en' // Default to English for WER analysis
			});

			await logger.logGeneral('info', 'Transcript summary generated', {
				summaryLength: summary.summary.length
			});
		}

		await logger.logGeneral('info', 'Starting WER-focused analysis', {
			fileId,
			modelName: modelName || 'default',
			transcriptLength: JSON.stringify(editorContent).length
		});

		// Initialize WER agent
		const werAgent = getCoordinatingAgentWER(modelName);

		// Start analysis in background (don't await)
		// This allows the API to return immediately while processing continues
		setImmediate(async () => {
			try {
				const result = await werAgent.analyzeFile({
					fileId,
					editorContent,
					summary,
					uiLanguage: 'en', // WER analysis in English
					transcriptFilePath: transcriptPath,
					audioFilePath: file.path,
					originalFilename: file.filename
				});

				await logger.logGeneral('info', 'WER analysis completed successfully', {
					totalBlocks: result.totalBlocks,
					completedBlocks: result.completedBlocks,
					successRate: `${((result.completedBlocks / result.totalBlocks) * 100).toFixed(1)}%`
				});
			} catch (error) {
				await logger.logGeneral('error', 'WER analysis failed', {
					error: error.message
				});

				// Mark any processing blocks as error
				await prisma.transcriptCorrection.updateMany({
					where: {
						fileId,
						status: 'processing'
					},
					data: {
						status: 'error',
						error: error.message
					}
				});
			}
		});

		return json({
			success: true,
			message: 'WER analysis started',
			fileId,
			estimatedBlocks: Math.ceil((editorContent?.content?.length || 1) / 20) // Rough estimate
		});
	} catch (error) {
		console.error('WER optimize API error:', error);

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

		// Get file and corrections status
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				uploader: true,
				filename: true,
				transcriptCorrections: {
					select: {
						blockIndex: true,
						status: true,
						processingTimeMs: true,
						createdAt: true,
						updatedAt: true,
						error: true
					},
					orderBy: { blockIndex: 'asc' }
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

		const corrections = file.transcriptCorrections;
		const totalBlocks = corrections.length;
		const completedBlocks = corrections.filter((tc) => tc.status === 'completed').length;
		const processingBlocks = corrections.filter((tc) => tc.status === 'processing').length;
		const errorBlocks = corrections.filter((tc) => tc.status === 'error').length;
		const pendingBlocks = corrections.filter((tc) => tc.status === 'pending').length;

		const isComplete = totalBlocks > 0 && completedBlocks === totalBlocks;
		const isProcessing = processingBlocks > 0;
		const hasErrors = errorBlocks > 0;

		return json({
			fileId: file.id,
			fileName: file.filename,
			werAnalysis: {
				totalBlocks,
				completedBlocks,
				processingBlocks,
				errorBlocks,
				pendingBlocks,
				isComplete,
				isProcessing,
				hasErrors,
				progressPercent: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0,
				blocks: corrections.map((tc) => ({
					blockIndex: tc.blockIndex,
					status: tc.status,
					processingTimeMs: tc.processingTimeMs,
					error: tc.error,
					createdAt: tc.createdAt,
					updatedAt: tc.updatedAt
				}))
			}
		});
	} catch (error) {
		console.error('WER optimize status API error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
