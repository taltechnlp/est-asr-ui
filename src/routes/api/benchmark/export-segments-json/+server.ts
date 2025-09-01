import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';
import { z } from 'zod';
import {
	exportWithSuggestionsApplied,
	exportWithCorrectedSegments,
	exportWithWERCorrections
} from '$lib/services/benchmarkExporter';
import { promises as fs } from 'fs';

const SegmentExportSchema = z.object({
	fileId: z.string(),
	minConfidence: z.number().min(0).max(1).optional().default(0.0),
	applyAll: z.boolean().optional().default(true)
});

interface ParsedSegment {
	segmentIndex: number;
	text: string;
}

/**
 * Parse corrected text to extract individual segments with [Segment N] markers
 */
function parseSegmentsFromCorrectedText(correctedText: string): ParsedSegment[] {
	const segments: ParsedSegment[] = [];
	
	// Pattern to match [Segment N] markers followed by content
	const segmentPattern = /\[Segment\s+(\d+)\]\s*(.*?)(?=\[Segment|\[Timing|$)/gs;
	
	let match;
	while ((match = segmentPattern.exec(correctedText)) !== null) {
		const segmentIndex = parseInt(match[1], 10);
		let text = match[2].trim();
		
		// Clean up the text - remove speaker tags, timing info, alternatives
		text = text
			.replace(/^[^:]+:\s*/, '') // Remove speaker prefixes like "Speaker A: "
			.replace(/\[Timing:.*?\]/g, '') // Remove timing blocks
			.replace(/\[Alternatives:.*?\]/g, '') // Remove alternatives blocks
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();
		
		if (text && !isNaN(segmentIndex)) {
			segments.push({
				segmentIndex,
				text
			});
		}
	}
	
	// If no segments found with [Segment N] pattern, try the actual WER agent format
	// WER agent outputs: "Speaker Name: text here\n\nSpeaker Name: more text here"
	if (segments.length === 0) {
		// Split by double newlines to get speaker segments
		const speakerBlocks = correctedText.split(/\n\s*\n/).filter(block => block.trim());
		
		speakerBlocks.forEach((block, index) => {
			const lines = block.split('\n').filter(line => line.trim());
			
			for (const line of lines) {
				// Match "Speaker Name: text" pattern
				const speakerMatch = line.match(/^([^:]+):\s*(.+)$/);
				if (speakerMatch) {
					const speakerName = speakerMatch[1].trim();
					const text = speakerMatch[2].trim();
					
					if (text && text.length > 3) { // Skip very short segments
						segments.push({
							segmentIndex: segments.length,
							text
						});
					}
				} else {
					// If no colon pattern, treat the whole line as text (fallback)
					const text = line.trim();
					if (text && text.length > 3) {
						segments.push({
							segmentIndex: segments.length,
							text
						});
					}
				}
			}
		});
	}
	
	// Final fallback: try to match any pattern with speaker info
	if (segments.length === 0) {
		// Try to match numbered lines like "1. text" or "Speaker 1: text"
		const linePattern = /(?:^|\n)(?:\d+\.?\s*|Speaker\s*\d+:\s*)(.*?)(?=\n\d+\.|\nSpeaker\s*\d+:|\n\[|$)/gs;
		let lineMatch;
		let segmentIndex = 0;
		
		while ((lineMatch = linePattern.exec(correctedText)) !== null) {
			let text = lineMatch[1].trim();
			
			if (text && text.length > 3) { // Skip very short segments
				segments.push({
					segmentIndex: segmentIndex++,
					text
				});
			}
		}
	}
	
	console.log(`parseSegmentsFromCorrectedText: Extracted ${segments.length} segments`);
	if (segments.length > 0) {
		console.log(`First parsed segment:`, segments[0]);
		console.log(`Last parsed segment:`, segments[segments.length - 1]);
	}
	
	return segments;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse and validate request
		const body = await request.json();
		const { fileId, minConfidence, applyAll } = SegmentExportSchema.parse(body);

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
		
		// If parsedContent is still a string, try to re-parse it as it might be double-encoded
		if (typeof parsedContent === 'string') {
			try {
				parsedContent = JSON.parse(parsedContent);
			} catch (error2) {
				// Ignore parsing errors
			}
		}

		// Check for WER corrections first (highest priority) - same logic as Apply & Export
		console.log(`[JSON Export] Querying for fileId: ${fileId}`);
		const werCorrections = await prisma.transcriptCorrection.findMany({
			where: { fileId },
			orderBy: { blockIndex: 'asc' }
		});
		console.log(`[JSON Export] Found ${werCorrections.length} WER corrections`);

		let analysisSegments = [];

		if (werCorrections.length === 0) {
			// Only query analysis segments if no WER corrections exist - same as Apply & Export
			console.log(`[JSON Export] No WER corrections, querying analysis segments`);
			analysisSegments = await prisma.analysisSegment.findMany({
				where: {
					fileId,
					status: 'analyzed'
				},
				orderBy: { segmentIndex: 'asc' }
			});
			console.log(`[JSON Export] Found ${analysisSegments.length} analyzed segments`);
		} else {
			// If WER corrections exist, we still need analysis segments for timing info
			console.log(`[JSON Export] Getting analysis segments for timing information`);
			analysisSegments = await prisma.analysisSegment.findMany({
				where: { fileId },
				orderBy: { segmentIndex: 'asc' }
			});
			console.log(`[JSON Export] Found ${analysisSegments.length} segments for timing`);
			
			if (analysisSegments.length > 0) {
				console.log(`[JSON Export] Sample segment indices:`, analysisSegments.slice(0, 5).map(s => s.segmentIndex));
				console.log(`[JSON Export] Sample segment timing:`, analysisSegments.slice(0, 2).map(s => ({
					index: s.segmentIndex,
					start: s.startTime,
					end: s.endTime
				})));
			}
		}

		// Check if we have either corrections or segments
		if (werCorrections.length === 0 && analysisSegments.length === 0) {
			return json(
				{
					error: 'No corrections or analyzed segments found. Please run analysis first.'
				},
				{ status: 400 }
			);
		}

		console.log(
			`Processing JSON segment export for file ${fileId}: ${analysisSegments.length} segments, ${werCorrections.length} WER corrections`
		);

		// Use the EXACT same export logic as Apply & Export
		let textExportResult;
		
		if (werCorrections.length > 0) {
			// Use WER corrections (same as Apply & Export)
			console.log(`Using WER corrections: ${werCorrections.length} blocks found`);
			textExportResult = exportWithWERCorrections(werCorrections);
		} else {
			// Fallback to existing logic for backward compatibility
			const segmentsWithCorrectedText = analysisSegments.filter((seg) => seg.correctedSegment);
			const useCorrectedSegments = segmentsWithCorrectedText.length > 0;

			console.log(`Export method: ${useCorrectedSegments ? 'corrected segments' : 'suggestion application'}`);

			// Choose export method based on availability of corrected segments  
			textExportResult = useCorrectedSegments
				? exportWithCorrectedSegments(parsedContent, analysisSegments)
				: exportWithSuggestionsApplied(parsedContent, analysisSegments, {
						minConfidence,
						applyAll,
						includeStats: true
				});
		}

		if (!textExportResult.success) {
			return json(
				{
					error: `Export failed: ${textExportResult.error}`
				},
				{ status: 500 }
			);
		}

		// Now convert the plain text result to JSON segments with proper timing
		// We need to get the actual timing from the original ASR data, not fallback estimates
		let segments = [];
		
		// Extract speaker segments with their timing from the ASR data
		
		const speakerSegmentsFromASR = [];
		
		// Handle different ASR data formats
		let contentToProcess = null;
		
		// Check if it's the TipTap editor format (has content array)
		if (parsedContent && parsedContent.content && Array.isArray(parsedContent.content)) {
			contentToProcess = parsedContent.content;
			
			contentToProcess.forEach((contentItem, speakerIndex) => {
				if (contentItem.type === 'speaker' && contentItem.content) {
					let segmentStartTime = null;
					let segmentEndTime = null;
					let segmentText = '';
					
					// Extract timing and text from wordNodes
					contentItem.content.forEach((wordItem) => {
						if (wordItem.type === 'wordNode' && wordItem.attrs) {
							const start = wordItem.attrs.start;
							const end = wordItem.attrs.end;
							const text = wordItem.content?.[0]?.text || '';
							
							if (start !== undefined && end !== undefined) {
								if (segmentStartTime === null || start < segmentStartTime) {
									segmentStartTime = start;
								}
								if (segmentEndTime === null || end > segmentEndTime) {
									segmentEndTime = end;
								}
							}
							
							if (text) {
								segmentText += (segmentText ? ' ' : '') + text;
							}
						} else if (wordItem.type === 'text' && wordItem.text) {
							segmentText += wordItem.text;
						}
					});
					
					if (segmentStartTime !== null && segmentEndTime !== null && segmentText.trim()) {
						speakerSegmentsFromASR.push({
							index: speakerIndex,
							start: segmentStartTime,
							end: segmentEndTime,
							originalText: segmentText.trim()
						});
					}
				}
			});
		}
		// Check if it's raw ASR format (has best_hypothesis)
		else if (parsedContent && parsedContent.best_hypothesis) {
			const bestHypothesis = parsedContent.best_hypothesis;
			
			// Parse the best hypothesis using the correct ASR schema structure
			if (bestHypothesis && bestHypothesis.sections && Array.isArray(bestHypothesis.sections)) {
				let segmentCounter = 0; // Use sequential numbering like WER agent
				bestHypothesis.sections.forEach((section, sectionIndex) => {
					
					if (section && section.turns && Array.isArray(section.turns)) {
						// Process each turn (speaker segment) within the section
						section.turns.forEach((turn, turnIndex) => {
							
							if (turn.words && Array.isArray(turn.words) && turn.words.length > 0) {
								let segmentStartTime = turn.start;
								let segmentEndTime = turn.end;
								let segmentText = '';
								
								// Extract text from words - use word_with_punctuation for proper formatting
								turn.words.forEach((word, wordIndex) => {
									// Use word_with_punctuation for proper text formatting
									const text = word.word_with_punctuation || word.word || '';
									
									if (text) {
										segmentText += (segmentText ? ' ' : '') + text;
									}
								});
								
								if (segmentStartTime !== null && segmentEndTime !== null && segmentText.trim()) {
									speakerSegmentsFromASR.push({
										index: segmentCounter++, // Sequential numbering like WER agent
										start: segmentStartTime,
										end: segmentEndTime,
										originalText: segmentText.trim(),
										speaker: turn.speaker
									});
								}
							} else if (turn.transcript) {
								// Fallback to transcript text if no words available
								speakerSegmentsFromASR.push({
									index: segmentCounter++, // Sequential numbering like WER agent
									start: turn.start,
									end: turn.end,
									originalText: turn.transcript.trim(),
									speaker: turn.speaker
								});
							}
						});
					}
				});
			}
		}
		console.log(`Extracted ${speakerSegmentsFromASR.length} speaker segments from ASR with timing`);
		
		if (werCorrections.length > 0) {
			// Use WER corrections but preserve original segment boundaries
			const completedCorrections = werCorrections
				.filter((tc) => tc.status === 'completed' && tc.correctedText)
				.sort((a, b) => a.blockIndex - b.blockIndex);
				
			console.log(`Processing ${completedCorrections.length} completed WER corrections with segment boundary recovery`);
			
			// Keep track of which segments have been processed to avoid duplicates
			const processedSegmentIndices = new Set<number>();
			
			for (const correction of completedCorrections) {
				const correctedText = correction.correctedText || '';
				const blockSegmentIndices = correction.segmentIndices || [];
				
				console.log(`Processing WER correction block ${correction.blockIndex} with ${blockSegmentIndices.length} segments`);
				console.log(`Corrected text length: ${correctedText.length} chars`);
				
				// Try to parse individual segments from corrected text using [Segment N] markers
				const parsedSegments = parseSegmentsFromCorrectedText(correctedText);
				console.log(`Parsed ${parsedSegments.length} segments from corrected text`);

				if (parsedSegments.length > 0) {
					// Map parsed segments back to original ASR timing
					console.log(`Mapping ${parsedSegments.length} parsed segments to ${blockSegmentIndices.length} block segments`);
					
					for (let i = 0; i < parsedSegments.length && i < blockSegmentIndices.length; i++) {
						const parsedSegment = parsedSegments[i];
						// Map relative segment index to actual ASR segment index
						const actualSegmentIndex = blockSegmentIndices[i];
						
						// Skip if already processed
						if (processedSegmentIndices.has(actualSegmentIndex)) {
							console.log(`Skipping already processed segment ${actualSegmentIndex}`);
							continue;
						}
						
						// Find corresponding ASR segment for timing
						const asrSegment = speakerSegmentsFromASR.find(asr => asr.index === actualSegmentIndex);
						if (asrSegment) {
							segments.push({
								start: asrSegment.start,
								end: asrSegment.end,
								text: parsedSegment.text.trim()
							});
							processedSegmentIndices.add(actualSegmentIndex);
							console.log(`Mapped parsed segment ${i} to ASR segment ${actualSegmentIndex} (${asrSegment.start}s-${asrSegment.end}s)`);
						} else {
							console.log(`No ASR segment found for index ${actualSegmentIndex}`);
						}
					}
					
					// Log if there's a mismatch in segment counts
					if (parsedSegments.length !== blockSegmentIndices.length) {
						console.log(`WARNING: Parsed segments (${parsedSegments.length}) != block segments (${blockSegmentIndices.length})`);
					}
				} else {
					// Fallback: if parsing failed, use original segments for this block
					console.log(`Segment parsing failed for block ${correction.blockIndex}, using original text`);
					for (const segmentIndex of blockSegmentIndices) {
						if (processedSegmentIndices.has(segmentIndex)) continue;
						
						const asrSegment = speakerSegmentsFromASR.find(asr => asr.index === segmentIndex);
						if (asrSegment) {
							segments.push({
								start: asrSegment.start,
								end: asrSegment.end,
								text: asrSegment.originalText.trim()
							});
							processedSegmentIndices.add(segmentIndex);
							console.log(`Added fallback segment ${segmentIndex}: ${asrSegment.start}s-${asrSegment.end}s`);
						}
					}
				}
			}
			
			// Add any remaining segments that weren't part of WER corrections
			for (const asrSegment of speakerSegmentsFromASR) {
				if (!processedSegmentIndices.has(asrSegment.index)) {
					segments.push({
						start: asrSegment.start,
						end: asrSegment.end,
						text: asrSegment.originalText.trim()
					});
					console.log(`Added non-corrected segment ${asrSegment.index}: ${asrSegment.start}s-${asrSegment.end}s`);
				}
			}
			
			// Sort segments by start time to maintain temporal order
			segments.sort((a, b) => a.start - b.start);
			
		} else {
			// Use individual segments from ASR with any corrections applied
			speakerSegmentsFromASR.forEach((asrSegment, index) => {
				let segmentText = asrSegment.originalText;
				
				// Check if there are corrections for this segment
				const correspondingAnalysisSegment = analysisSegments.find(as => as.segmentIndex === index);
				if (correspondingAnalysisSegment?.correctedSegment) {
					segmentText = correspondingAnalysisSegment.correctedSegment;
				}
				
				segments.push({
					start: asrSegment.start,
					end: asrSegment.end,
					text: segmentText.trim()
				});
			});
		}

		console.log(`Generated ${segments.length} segments for JSON export`);
		
		if (segments.length === 0) {
			console.error(`ERROR: No segments generated!`);
			console.error(`WER corrections: ${werCorrections.length}, ASR segments: ${speakerSegmentsFromASR.length}, Analysis segments: ${analysisSegments.length}`);
		}

		const exportResult = {
			success: true,
			segments: segments,
			exportStats: textExportResult.exportStats
		};

		// Generate safe filename
		const safeFileName = (file.filename || 'transcript')
			.replace(/[^a-zA-Z0-9.-]/g, '_')
			.replace(/_+/g, '_');

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const fileName = `${safeFileName}_segments_${timestamp}.json`;

		console.log('Segment JSON export successful:', {
			fileName,
			segmentCount: exportResult.segments?.length || 0,
			stats: exportResult.exportStats
		});

		return json({
			success: true,
			fileName,
			stats: exportResult.exportStats,
			segments: exportResult.segments
		});
	} catch (error) {
		console.error('Segment JSON export API error:', error);

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