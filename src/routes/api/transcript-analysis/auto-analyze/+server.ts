import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import type { TipTapEditorContent } from '../../../../types/index.js';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import { extractSpeakerSegments } from '$lib/utils/extractWordsFromEditor';
import { fromNewEstFormatAI } from '$lib/helpers/converters/newEstFormatAI';
import { createCorrectionAgent } from '$lib/agents/correctionAgent';
import type { TimedSegment } from '$lib/utils/textAlignment';
import { isNewFormat } from '$lib/helpers/converters/newEstFormat';
import type { TranscriptionResult } from '$lib/helpers/api.d';
import { promises as fs } from 'fs';
import { getAgentFileLogger } from '$lib/utils/agentFileLogger';

const AutoAnalyzeSchema = z.object({
	fileId: z.string()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse and validate request
		const body = await request.json();
		const { fileId } = AutoAnalyzeSchema.parse(body);

		// Get file first to check ownership and auto-analysis flag
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
				language: true,
				path: true,
				filename: true // For alternative ASR matching
			}
		});

		if (!file) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Check authentication - but allow server-to-server calls for auto-analysis
		const session = await locals.auth();

		// For auto-analysis requests, we allow server-to-server calls (no session required)
		// but we still verify the file has autoAnalyze enabled
		if (!file.autoAnalyze) {
			return json({ error: 'Auto-analysis not requested for this file' }, { status: 400 });
		}

		// If there's a session, verify ownership (for manual calls)
		if (session?.user && file.uploader !== session.user.id) {
			return json({ error: 'Access denied' }, { status: 403 });
		}

		if (file.state !== 'READY') {
			return json({ error: 'File not ready for analysis' }, { status: 400 });
		}

		if (!file.autoAnalyze) {
			return json({ error: 'Auto-analysis not requested for this file' }, { status: 400 });
		}

		// Wait for transcript file to be available (with retry mechanism)
		let retryCount = 0;
		const maxRetries = 10; // Wait up to 50 seconds (10 * 5 second intervals)
		let transcriptContent = null;

		while (!transcriptContent && retryCount < maxRetries) {
			try {
				if (file.initialTranscriptionPath) {
					// Try to read from file path
					const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');
					transcriptContent = content;
				} else if (file.text) {
					// Fallback to database content
					transcriptContent = file.text;
				} else if (file.initialTranscription) {
					// Fallback to database initialTranscription
					transcriptContent = file.initialTranscription;
				}
			} catch (error) {}

			if (!transcriptContent) {
				await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
				retryCount++;
			}
		}

		if (!transcriptContent) {
			throw new Error(`Transcript content not available after waiting ${maxRetries * 5} seconds`);
		}

		// Initialize logger
		const transcriptPath = file.initialTranscriptionPath || `/tmp/${file.id}.transcript`;
		const logger = getAgentFileLogger(transcriptPath, file.id);

		await logger.logGeneral('info', 'Starting auto-analysis', {
			fileId,
			filename: file.filename,
			fileSize: transcriptContent?.length || 0
		});

		// Log progress marker for long-running operations
		console.log(
			`[AUTO-ANALYSIS] Starting analysis for file: ${file.filename} (${file.id}) - Content length: ${transcriptContent?.length || 0} chars`
		);

		// Set up periodic heartbeat for long-running operations
		const heartbeatInterval = setInterval(() => {
			console.log(
				`[AUTO-ANALYSIS] Still processing file: ${file.filename} (${file.id}) - Analysis in progress...`
			);
		}, 60000); // Every 60 seconds

		try {
			// Step 1: Extract segments from transcript

			if (!transcriptContent) {
				throw new Error('No transcript content available for segment extraction');
			}

			const parsedContent = JSON.parse(transcriptContent);

			// Create segments directly from new format structure
			const segments = [];

			if (isNewFormat(parsedContent)) {
				const sections = parsedContent.best_hypothesis.sections || [];
				let segmentIndex = 0;

				sections.forEach((section) => {
					if (section.type === 'speech' && section.turns) {
						section.turns.forEach((turn) => {
							if (
								turn.transcript &&
								turn.words &&
								Array.isArray(turn.words) &&
								turn.words.length > 0
							) {
								segments.push({
									index: segmentIndex++,
									startTime: turn.start,
									endTime: turn.end,
									startWord: 0, // Will be updated if needed
									endWord: turn.words.length - 1,
									text: turn.transcript,
									speakerTag: turn.speaker,
									speakerName:
										parsedContent.best_hypothesis.speakers[turn.speaker]?.name || turn.speaker,
									words: (turn.words || [])
										.filter(
											(word) =>
												word &&
												typeof word === 'object' &&
												(word.word_with_punctuation || word.word)
										)
										.map((word) => ({
											text:
												word.word_with_punctuation && typeof word.word_with_punctuation === 'string'
													? word.word_with_punctuation
													: word.word && typeof word.word === 'string'
														? word.word
														: '',
											start: typeof word.start === 'number' ? word.start : 0,
											end: typeof word.end === 'number' ? word.end : 0,
											speakerTag: turn.speaker
										}))
								});
							}
						});
					}
				});
			} else {
				// Old format - use existing word extraction approach
				const speakerSegments = extractSpeakerSegments(parsedContent);
				segments.push(...speakerSegments);
			}

			// Process all segments
			await logger.logGeneral('info', 'Extracted segments for analysis', {
				segmentCount: segments.length
			});

			// Step 2: Process with Correction Agent

			// Convert segments to TimedSegment format for correction agent
			const timedSegments: TimedSegment[] = segments.map((seg) => ({
				index: seg.index,
				startTime: seg.startTime,
				endTime: seg.endTime,
				text: seg.text,
				speakerTag: seg.speakerTag || seg.speakerName || 'Unknown Speaker'
			}));

			const agent = createCorrectionAgent({
				modelId: 'anthropic/claude-3.5-sonnet',
				batchSize: 20,
				temperature: 0.3
			});

			await logger.logGeneral('info', 'Starting correction agent', {
				transcriptFormat: isNewFormat(parsedContent) ? 'new' : 'legacy',
				segmentCount: timedSegments.length
			});

			console.log(
				`[AUTO-ANALYSIS] Starting correction agent for file: ${file.filename} - ${timedSegments.length} segments`
			);

			// Correction agent processes entire file in 20-segment blocks
			const correctionResult = await agent.correctFile(file.id, timedSegments);

			await logger.logGeneral('info', 'Correction completed', {
				totalBlocks: correctionResult.totalBlocks,
				completedBlocks: correctionResult.completedBlocks,
				successRate: correctionResult.successRate
			});

			console.log(
				`[AUTO-ANALYSIS] Completed correction for file: ${file.filename} - ${correctionResult.completedBlocks}/${correctionResult.totalBlocks} blocks processed`
			);

			// Clear heartbeat interval
			clearInterval(heartbeatInterval);

			return json({
				success: true,
				fileId,
				summaryGenerated: false, // No summary generation with new agent
				analysisMethod: 'CorrectionAgent',
				totalBlocks: correctionResult.totalBlocks,
				completedBlocks: correctionResult.completedBlocks,
				successRate: correctionResult.successRate,
				results: correctionResult.blocks
			});
		} catch (error) {
			// Clear heartbeat interval on error
			clearInterval(heartbeatInterval);

			if (transcriptPath && file.id) {
				const logger = getAgentFileLogger(transcriptPath, file.id);
				await logger.logGeneral('error', 'Auto-analysis failed', {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : 'No stack trace'
				});
			}
			console.error('Auto-analysis detailed error:', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : 'No stack trace',
				fileId: file?.id
			});
			return json(
				{
					error: `Auto-analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
