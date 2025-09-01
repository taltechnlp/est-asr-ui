import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import type { TranscriptSummary } from '@prisma/client';
import type { TipTapEditorContent } from '../../../../types/index.js';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import { extractWordsFromEditor } from '$lib/utils/extractWordsFromEditor';
import { fromNewEstFormatAI } from '$lib/helpers/converters/newEstFormatAI';
import { getCoordinatingAgentWER } from '$lib/agents/coordinatingAgentWER';
import { getSummaryGenerator } from '$lib/agents/summaryGenerator';
import { extractFullTextWithSpeakers } from '$lib/utils/extractWordsFromEditor';
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
				path: true
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
		console.log(`[AUTO-ANALYSIS] Starting analysis for file: ${file.filename} (${file.id}) - Content length: ${transcriptContent?.length || 0} chars`);

		// Set up periodic heartbeat for long-running operations
		const heartbeatInterval = setInterval(() => {
			console.log(`[AUTO-ANALYSIS] Still processing file: ${file.filename} (${file.id}) - Analysis in progress...`);
		}, 60000); // Every 60 seconds

		try {
			// Step 1: Generate Summary (prerequisite for analysis)
			const summaryGenerator = getSummaryGenerator();

			// Check if summary already exists
			const existingSummary = await prisma.transcriptSummary.findUnique({
				where: { fileId: file.id }
			});

			let summary: TranscriptSummary;
			if (existingSummary) {
				await logger.logGeneral('info', 'Using existing summary', {
					summaryId: existingSummary.id
				});
				summary = existingSummary;
			} else {
				// Extract full text for summary generation from transcript content
				let fullText = '';
				try {
					const parsedContent = JSON.parse(transcriptContent);

					// Check if it's the new ASR format
					if (isNewFormat(parsedContent)) {
						// Extract text from new format by combining all transcript fields
						const sections = parsedContent.best_hypothesis.sections || [];
						const textParts = [];

						sections.forEach((section) => {
							if (section.type === 'speech' && section.turns) {
								section.turns.forEach((turn) => {
									if (turn.transcript) {
										textParts.push(turn.transcript);
									}
								});
							}
						});

						fullText = textParts.join(' ');
					} else if (parsedContent.type === 'doc' && parsedContent.content) {
						// TipTap format - use existing extraction
						fullText = extractFullTextWithSpeakers(parsedContent);
					} else if (typeof parsedContent === 'string') {
						fullText = parsedContent;
					} else if (parsedContent.content) {
						// Try to extract from content field
						const contentStr =
							typeof parsedContent.content === 'string'
								? parsedContent.content
								: JSON.stringify(parsedContent.content);
						fullText = contentStr;
					} else if (parsedContent.text) {
						// Try to extract from text field
						fullText = parsedContent.text;
					} else {
						// Last resort - stringify the whole object (but limit size for summary)
						const stringified = JSON.stringify(parsedContent);
						fullText = stringified.substring(0, 10000); // Limit to 10k chars
					}
				} catch (error) {
					// If JSON parsing fails, treat as plain text
					fullText = transcriptContent.substring(0, 10000); // Limit to 10k chars for summary
				}

				if (!fullText) {
					throw new Error('No transcript content available for summary generation');
				}

				await logger.logGeneral('info', 'Generating new summary', { textLength: fullText.length });

				summary = await summaryGenerator.generateSummary(
					file.id,
					fullText,
					{ uiLanguage: 'en' } // Default to English for auto-analysis
				);

				await logger.logGeneral('info', 'Summary generated successfully', {
					summaryId: summary.id
				});
			}

			// Step 2: Extract segments

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
				const extractedWords = extractWordsFromEditor(parsedContent);

				let currentSegment = null;

				for (const word of extractedWords) {
					if (!currentSegment || currentSegment.speakerTag !== word.speakerTag) {
						if (currentSegment) {
							segments.push(currentSegment);
						}
						currentSegment = {
							index: segments.length,
							startTime: word.start,
							endTime: word.end,
							startWord: extractedWords.indexOf(word),
							endWord: extractedWords.indexOf(word),
							text: word.text,
							speakerTag: word.speakerTag,
							speakerName: word.speakerTag,
							words: [word]
						};
					} else {
						currentSegment.text += ' ' + word.text;
						currentSegment.endTime = word.end;
						currentSegment.endWord = extractedWords.indexOf(word);
						currentSegment.words.push(word);
					}
				}

				if (currentSegment) {
					segments.push(currentSegment);
				}
			}

			// Process all segments
			await logger.logGeneral('info', 'Extracted segments for analysis', {
				segmentCount: segments.length
			});

			// Step 3: Process with WER Agent (handles blocks automatically)

			// Convert segments back to TipTap format for WER agent
			let editorContent: TipTapEditorContent;
			if (isNewFormat(parsedContent)) {
				const result = fromNewEstFormatAI(parsedContent as TranscriptionResult);
				editorContent = result.transcription;
			} else {
				editorContent = parsedContent;
			}

			const agent = getCoordinatingAgentWER();

			await logger.logGeneral('info', 'Starting WER analysis', {
				transcriptFormat: isNewFormat(parsedContent) ? 'new' : 'legacy',
				segmentCount: segments.length,
				contentLength: JSON.stringify(editorContent).length
			});
			
			console.log(`[AUTO-ANALYSIS] Starting WER agent processing for file: ${file.filename} - ${segments.length} segments`);

			// WER agent processes entire file in 20-segment blocks
			const analysisResult = await agent.analyzeFile({
				fileId: file.id,
				editorContent,
				summary,
				uiLanguage: 'et', // Estonian for transcript analysis
				transcriptFilePath: file.initialTranscriptionPath
			});

			await logger.logGeneral('info', 'WER analysis completed', {
				totalBlocks: analysisResult.totalBlocks,
				completedBlocks: analysisResult.completedBlocks,
				successRate: `${((analysisResult.completedBlocks / analysisResult.totalBlocks) * 100).toFixed(1)}%`
			});
			
			console.log(`[AUTO-ANALYSIS] Completed WER analysis for file: ${file.filename} - ${analysisResult.completedBlocks}/${analysisResult.totalBlocks} blocks processed`);

			// Clear heartbeat interval
			clearInterval(heartbeatInterval);

			return json({
				success: true,
				fileId,
				summaryGenerated: !existingSummary,
				analysisMethod: 'WER',
				totalBlocks: analysisResult.totalBlocks,
				completedBlocks: analysisResult.completedBlocks,
				successRate:
					((analysisResult.completedBlocks / analysisResult.totalBlocks) * 100).toFixed(1) + '%',
				results: analysisResult.results
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
