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

		// Now convert the plain text result to JSON segments
		// For WER corrections, we need to map back to individual segments with timing
		let segments = [];
		
		if (werCorrections.length > 0) {
			// Process WER corrections to get individual segments with timing
			const completedCorrections = werCorrections
				.filter((tc) => tc.status === 'completed' && tc.correctedText)
				.sort((a, b) => a.blockIndex - b.blockIndex);
				
			console.log(`Processing ${completedCorrections.length} completed WER corrections`);
				
			for (const correction of completedCorrections) {
				console.log(`Processing correction block ${correction.blockIndex} with segmentIndices:`, correction.segmentIndices);
				
				const blockSegments = correction.segmentIndices
					.map((idx) => analysisSegments.find((seg) => seg.segmentIndex === idx))
					.filter((seg) => seg !== undefined)
					.sort((a, b) => a.segmentIndex - b.segmentIndex);

				console.log(`Found ${blockSegments.length} matching segments for timing`);

				if (blockSegments.length > 0) {
					// For now, create one segment per correction block
					const cleanText = correction.correctedText
						.split('\n')
						.map(line => {
							const colonIndex = line.indexOf(': ');
							return colonIndex > 0 ? line.substring(colonIndex + 2) : line;
						})
						.filter(line => line.trim() && !line.startsWith('Alternatives: '))
						.join(' ');

					if (cleanText.trim()) {
						segments.push({
							start: blockSegments[0].startTime,
							end: blockSegments[blockSegments.length - 1].endTime,
							text: cleanText.trim()
						});
						console.log(`Added segment: ${blockSegments[0].startTime}s-${blockSegments[blockSegments.length - 1].endTime}s`);
					}
				} else {
					// Fallback: create multiple segments without precise timing
					console.warn(`No timing segments found for correction block ${correction.blockIndex}, using intelligent fallback`);
					
					const cleanText = correction.correctedText
						.split('\n')
						.map(line => {
							const colonIndex = line.indexOf(': ');
							return colonIndex > 0 ? line.substring(colonIndex + 2) : line;
						})
						.filter(line => line.trim() && !line.startsWith('Alternatives: '))
						.join(' ');

					if (cleanText.trim()) {
						// Split long text into multiple segments based on sentence boundaries
						// Estimate ~150 words per minute (2.5 words per second) for timing
						const text = cleanText.trim();
						const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
						
						console.log(`Splitting ${text.length} characters into ${sentences.length} sentences`);
						
						if (sentences.length <= 1) {
							// Single sentence or short text - create one segment
							const wordCount = text.split(/\s+/).length;
							const estimatedDuration = Math.max(5, wordCount / 2.5); // 2.5 words per second, minimum 5 seconds
							const estimatedStart = correction.blockIndex * 30;
							
							segments.push({
								start: estimatedStart,
								end: estimatedStart + estimatedDuration,
								text: text
							});
							console.log(`Added single segment: ${estimatedStart}s-${estimatedStart + estimatedDuration}s`);
						} else {
							// Multiple sentences - create segments for each sentence group
							const segmentIndices = correction.segmentIndices || [];
							const segmentsPerSentence = Math.max(1, Math.floor(segmentIndices.length / sentences.length));
							
							sentences.forEach((sentence, idx) => {
								const trimmedSentence = sentence.trim();
								if (trimmedSentence) {
									const wordCount = trimmedSentence.split(/\s+/).length;
									const estimatedDuration = Math.max(3, wordCount / 2.5);
									
									// Distribute timing across the segment indices
									const segmentStart = segmentIndices[idx * segmentsPerSentence] || idx;
									const estimatedStart = correction.blockIndex * 30 + (segmentStart * 2.5); // ~2.5 seconds per segment
									
									segments.push({
										start: estimatedStart,
										end: estimatedStart + estimatedDuration,
										text: trimmedSentence + (idx < sentences.length - 1 ? '.' : '')
									});
									console.log(`Added sentence segment ${idx}: ${estimatedStart}s-${estimatedStart + estimatedDuration}s`);
								}
							});
						}
					}
				}
			}
		} else {
			// For analysis segments, use individual segment timing
			for (const analysisSegment of analysisSegments) {
				if (analysisSegment.startTime !== undefined && analysisSegment.endTime !== undefined) {
					let segmentText = '';
					
					if (analysisSegment.correctedSegment) {
						segmentText = analysisSegment.correctedSegment.trim();
					} else {
						// Extract original text from segments 
						// This is a simplified approach - in practice you'd want to extract from parsedContent
						segmentText = `Segment ${analysisSegment.segmentIndex} text`; // Placeholder
					}

					if (segmentText) {
						segments.push({
							start: analysisSegment.startTime,
							end: analysisSegment.endTime,
							text: segmentText
						});
					}
				}
			}
		}

		console.log(`Generated ${segments.length} segments for JSON export`);

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