/**
 * Service for applying ASR correction suggestions and exporting plain text for benchmarking
 * Creates a clean copy of the transcript with all suggestions applied
 */

import type { AnalysisSegment, TranscriptCorrection } from '@prisma/client';
import { extractSpeakerSegments } from '$lib/utils/extractWordsFromEditor';
import type { TipTapEditorContent } from '../../types';

export interface BenchmarkExportResult {
	success: boolean;
	plainText?: string;
	fileName?: string;
	exportStats: {
		totalSegments: number;
		totalSuggestions: number;
		appliedSuggestions: number;
		skippedSuggestions: number;
		processingTimeMs: number;
	};
	segmentDetails: Array<{
		segmentIndex: number;
		originalText: string;
		modifiedText: string;
		suggestionsApplied: number;
		suggestionsSkipped: number;
	}>;
	error?: string;
}

/**
 * Apply suggestions to segment text using simple string replacement
 */
function applySegmentSuggestions(
	segmentText: string,
	suggestions: any[],
	options: { minConfidence: number; applyAll: boolean }
): {
	modifiedText: string;
	appliedCount: number;
	skippedCount: number;
	appliedSuggestions: string[];
	skippedSuggestions: { originalText: string; suggestedText: string; reason: string }[];
} {
	let modifiedText = segmentText;
	let appliedCount = 0;
	let skippedCount = 0;
	const appliedSuggestions: string[] = [];
	const skippedSuggestions: { originalText: string; suggestedText: string; reason: string }[] = [];

	// Helper function to normalize text for comparison
	const normalizeForComparison = (text: string): string => {
		return text.replace(/\s+/g, ' ').trim();
	};

	for (const [index, suggestion] of suggestions.entries()) {
		// Skip suggestions below confidence threshold
		if (suggestion.confidence < options.minConfidence) {
			skippedCount++;
			skippedSuggestions.push({
				originalText: suggestion.originalText,
				suggestedText: suggestion.suggestedText,
				reason: `Confidence ${suggestion.confidence} below threshold ${options.minConfidence}`
			});
			continue;
		}

		// Skip suggestions not marked for auto-apply if applyAll is false
		if (!options.applyAll && !suggestion.shouldAutoApply) {
			skippedCount++;
			skippedSuggestions.push({
				originalText: suggestion.originalText,
				suggestedText: suggestion.suggestedText,
				reason: 'shouldAutoApply is false'
			});
			continue;
		}

		const originalText = suggestion.originalText;
		const normalizedOriginal = normalizeForComparison(originalText);
		const normalizedSegment = normalizeForComparison(modifiedText);

		// Try exact string match first
		if (modifiedText.includes(originalText)) {
			modifiedText = modifiedText.replace(originalText, suggestion.suggestedText);
			appliedCount++;
			appliedSuggestions.push(
				`"${originalText}" -> "${suggestion.suggestedText}" [severity: ${suggestion.severity || 'N/A'}, order: ${index + 1}]`
			);
		}
		// Try normalized match (handles spacing differences)
		else if (normalizedSegment.includes(normalizedOriginal)) {
			// Find the position in the normalized text
			const normalizedIndex = normalizedSegment.indexOf(normalizedOriginal);

			// Map back to original text to find the actual text to replace
			// This is tricky, so let's use a simpler approach: split and rejoin
			const words = modifiedText.split(/\s+/);
			const normalizedWords = originalText.split(/\s+/);

			// Find sequence of words that matches
			for (let i = 0; i <= words.length - normalizedWords.length; i++) {
				const candidateWords = words.slice(i, i + normalizedWords.length);
				const candidateText = candidateWords.join(' ');

				if (normalizeForComparison(candidateText) === normalizedOriginal) {
					// Found the match - replace these words
					const before = words.slice(0, i);
					const after = words.slice(i + normalizedWords.length);
					const replacement = suggestion.suggestedText.split(/\s+/);

					const newWords = [...before, ...replacement, ...after];
					modifiedText = newWords.join(' ');
					appliedCount++;
					appliedSuggestions.push(
						`"${candidateText}" -> "${suggestion.suggestedText}" [severity: ${suggestion.severity || 'N/A'}, order: ${index + 1}]`
					);
					break;
				}
			}

			// If we didn't find a word-based match, fall back to case-insensitive
			if (appliedSuggestions.length === appliedCount - 1) {
				const lowerText = modifiedText.toLowerCase();
				const lowerSearch = originalText.toLowerCase();
				const index = lowerText.indexOf(lowerSearch);

				if (index !== -1) {
					const actualText = modifiedText.substring(index, index + originalText.length);
					modifiedText = modifiedText.replace(actualText, suggestion.suggestedText);
					appliedSuggestions.push(
						`"${actualText}" -> "${suggestion.suggestedText}" [severity: ${suggestion.severity || 'N/A'}, order: ${index + 1}]`
					);
				} else {
					appliedCount--; // Revert the increment
				}
			}
		}
		// Try case-insensitive match
		else if (modifiedText.toLowerCase().includes(originalText.toLowerCase())) {
			const lowerText = modifiedText.toLowerCase();
			const lowerSearch = originalText.toLowerCase();
			const idx = lowerText.indexOf(lowerSearch);
			const actualText = modifiedText.substring(idx, idx + originalText.length);

			modifiedText = modifiedText.replace(actualText, suggestion.suggestedText);
			appliedCount++;
			appliedSuggestions.push(
				`"${actualText}" -> "${suggestion.suggestedText}" [severity: ${suggestion.severity || 'N/A'}, order: ${index + 1}]`
			);
		} else {
			skippedCount++;
			skippedSuggestions.push({
				originalText: suggestion.originalText,
				suggestedText: suggestion.suggestedText,
				reason: 'Text not found in segment'
			});
		}
	}

	return { modifiedText, appliedCount, skippedCount, appliedSuggestions, skippedSuggestions };
}

/**
 * Apply all ASR correction suggestions to editor content and export as plain text
 * Simple segment-based approach using string replacement
 */
export function exportWithSuggestionsApplied(
	editorContent: TipTapEditorContent,
	analysisSegments: AnalysisSegment[],
	options: {
		minConfidence?: number;
		applyAll?: boolean;
		includeStats?: boolean;
	} = {}
): BenchmarkExportResult {
	const startTime = Date.now();
	const { minConfidence = 0.0, applyAll = true, includeStats = true } = options;

	try {
		console.log(
			`Starting segment-based suggestion application for ${analysisSegments.length} analysis segments`
		);

		// Extract speaker segments from editor content
		const segments = extractSpeakerSegments(editorContent);
		console.log(`Extracted ${segments.length} speaker segments from editor content`);

		// Create a map of suggestions by segment index
		const suggestionsBySegment = new Map<number, any[]>();
		let totalSuggestions = 0;

		for (const analysisSegment of analysisSegments) {
			try {
				let parsedSuggestions = analysisSegment.suggestions;
				if (typeof parsedSuggestions === 'string') {
					parsedSuggestions = JSON.parse(parsedSuggestions);
				}

				let suggestionArray: any[] = [];
				if (Array.isArray(parsedSuggestions)) {
					suggestionArray = parsedSuggestions;
				} else if (
					parsedSuggestions &&
					typeof parsedSuggestions === 'object' &&
					'suggestions' in parsedSuggestions
				) {
					const wrapped = parsedSuggestions as any;
					if (Array.isArray(wrapped.suggestions)) {
						suggestionArray = wrapped.suggestions;
					}
				}

				if (suggestionArray.length > 0) {
					suggestionsBySegment.set(analysisSegment.segmentIndex, suggestionArray);
					totalSuggestions += suggestionArray.length;
				}
			} catch (error) {
				console.error(
					`Error parsing suggestions for segment ${analysisSegment.segmentIndex}:`,
					error
				);
			}
		}

		console.log(
			`Parsed suggestions for ${suggestionsBySegment.size} segments, total ${totalSuggestions} suggestions`
		);

		// Apply suggestions to each segment
		const modifiedSegments: string[] = [];
		let totalApplied = 0;
		let totalSkipped = 0;
		const allAppliedSuggestions: string[] = [];
		const allSkippedSuggestions: { originalText: string; suggestedText: string; reason: string }[] =
			[];

		const segmentDetails = segments.map((segment) => {
			const suggestions = suggestionsBySegment.get(segment.index) || [];

			// Debug logging for problematic segments
			if (suggestions.length > 0 && segment.index < 5) {
				console.log(`\nSegment ${segment.index} text:`, JSON.stringify(segment.text));
				console.log(`Suggestions for segment ${segment.index}:`);
				suggestions.slice(0, 3).forEach((s, i) => {
					console.log(
						`  ${i + 1}. "${s.originalText}" -> "${s.suggestedText}" | Severity: ${s.severity || 'N/A'}`
					);
				});
			}

			// Sort suggestions by severity (higher first), then by original text length (shorter first)
			// This prevents overlapping suggestions from interfering with each other
			const sortedSuggestions = [...suggestions].sort((a, b) => {
				// First, sort by severity (higher severity first)
				const severityA = a.severity || 0;
				const severityB = b.severity || 0;
				if (severityA !== severityB) {
					return severityB - severityA; // Higher severity first
				}

				// If severity is equal, sort by original text length (shorter first)
				// Shorter replacements are less likely to conflict with longer ones
				const lengthA = a.originalText ? a.originalText.length : 0;
				const lengthB = b.originalText ? b.originalText.length : 0;
				return lengthA - lengthB; // Shorter first
			});

			const result = applySegmentSuggestions(segment.text, sortedSuggestions, {
				minConfidence,
				applyAll
			});

			modifiedSegments.push(result.modifiedText.trim());
			totalApplied += result.appliedCount;
			totalSkipped += result.skippedCount;
			allAppliedSuggestions.push(...result.appliedSuggestions);
			allSkippedSuggestions.push(...result.skippedSuggestions);

			return {
				segmentIndex: segment.index,
				originalText: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
				modifiedText:
					result.modifiedText.substring(0, 100) + (result.modifiedText.length > 100 ? '...' : ''),
				suggestionsApplied: result.appliedCount,
				suggestionsSkipped: result.skippedCount
			};
		});

		// Join all modified segments
		const plainText = modifiedSegments.filter((text) => text.length > 0).join('\n');
		const processingTimeMs = Date.now() - startTime;

		console.log('Segment-based benchmark export completed:', {
			totalSegments: segments.length,
			totalSuggestions,
			appliedSuggestions: totalApplied,
			skippedSuggestions: totalSkipped,
			processingTimeMs,
			textLength: plainText.length
		});

		// Log some sample applied and skipped suggestions
		if (allAppliedSuggestions.length > 0) {
			console.log('Sample applied suggestions:');
			allAppliedSuggestions.slice(0, 5).forEach((applied, index) => {
				console.log(`${index + 1}. ${applied}`);
			});
		}

		if (allSkippedSuggestions.length > 0) {
			console.log('Sample skipped suggestions:');
			allSkippedSuggestions.slice(0, 5).forEach((skipped, index) => {
				console.log(
					`${index + 1}. "${skipped.originalText}" -> "${skipped.suggestedText}" | Reason: ${skipped.reason}`
				);
			});

			console.log('\n=== ALL UNSUCCESSFUL SUGGESTIONS ===');
			allSkippedSuggestions.forEach((skipped, index) => {
				console.log(
					`${index + 1}. "${skipped.originalText}" -> "${skipped.suggestedText}" | Reason: ${skipped.reason}`
				);
			});
			console.log('=== END UNSUCCESSFUL SUGGESTIONS ===\n');
		}

		return {
			success: true,
			plainText,
			fileName: `corrected_transcript_${Date.now()}.txt`,
			exportStats: {
				totalSegments: segments.length,
				totalSuggestions,
				appliedSuggestions: totalApplied,
				skippedSuggestions: totalSkipped,
				processingTimeMs
			},
			segmentDetails
		};
	} catch (error) {
		const processingTimeMs = Date.now() - startTime;
		console.error('Segment-based benchmark export failed:', error);

		return {
			success: false,
			exportStats: {
				totalSegments: 0,
				totalSuggestions: 0,
				appliedSuggestions: 0,
				skippedSuggestions: 0,
				processingTimeMs
			},
			segmentDetails: [],
			error: error instanceof Error ? error.message : 'Unknown error during export'
		};
	}
}

/**
 * Generate a summary report of the benchmark export process
 */
export function generateExportReport(result: BenchmarkExportResult): string {
	if (!result.success) {
		return `Benchmark Export Failed: ${result.error}`;
	}

	const stats = result.exportStats;
	const successRate =
		stats.totalSuggestions > 0
			? ((stats.appliedSuggestions / stats.totalSuggestions) * 100).toFixed(1)
			: '0';

	return `Benchmark Export Report
=========================
Total Segments: ${stats.totalSegments}
Total Suggestions: ${stats.totalSuggestions}
Applied: ${stats.appliedSuggestions}
Skipped: ${stats.skippedSuggestions}
Success Rate: ${successRate}%
Processing Time: ${stats.processingTimeMs}ms
Output Length: ${result.plainText?.length || 0} characters
${result.plainText?.split('\n').length || 0} lines`;
}

/**
 * Export transcript using corrected segments instead of applying suggestions
 * This avoids the complexity and potential conflicts of suggestion application
 */
export function exportWithCorrectedSegments(
	editorContent: TipTapEditorContent,
	analysisSegments: AnalysisSegment[]
): BenchmarkExportResult {
	const startTime = Date.now();

	try {
		console.log(
			`Starting corrected segments export for ${analysisSegments.length} analysis segments`
		);

		// Extract speaker segments from editor content
		const segments = extractSpeakerSegments(editorContent);
		console.log(`Extracted ${segments.length} speaker segments from editor content`);

		// Create a map of corrected segments by segment index
		const correctedSegmentsByIndex = new Map<number, string>();
		let totalWithCorrectedSegments = 0;

		for (const analysisSegment of analysisSegments) {
			if (analysisSegment.correctedSegment) {
				correctedSegmentsByIndex.set(
					analysisSegment.segmentIndex,
					analysisSegment.correctedSegment
				);
				totalWithCorrectedSegments++;
			}
		}

		console.log(
			`Found corrected segments for ${totalWithCorrectedSegments}/${analysisSegments.length} analysis segments`
		);

		// Build the export using corrected segments where available, original text otherwise
		const exportSegments: string[] = [];
		let usedCorrected = 0;
		let usedOriginal = 0;

		const segmentDetails = segments.map((segment, index) => {
			const correctedText = correctedSegmentsByIndex.get(segment.index);
			const textToUse = correctedText || segment.reconstructedText;

			if (correctedText) {
				usedCorrected++;
			} else {
				usedOriginal++;
			}

			exportSegments.push(textToUse);

			return {
				segmentIndex: segment.index,
				originalText: segment.reconstructedText,
				modifiedText: textToUse,
				suggestionsApplied: correctedText ? 1 : 0, // 1 if corrected segment was used, 0 otherwise
				suggestionsSkipped: 0
			};
		});

		// Join segments with proper spacing
		const plainText = exportSegments.join(' ');
		const processingTimeMs = Date.now() - startTime;

		console.log(
			`Corrected segments export completed: ${usedCorrected} corrected, ${usedOriginal} original`
		);

		return {
			success: true,
			plainText,
			fileName: `corrected_transcript_${Date.now()}.txt`,
			exportStats: {
				totalSegments: segments.length,
				totalSuggestions: totalWithCorrectedSegments, // Number of segments that had corrections
				appliedSuggestions: usedCorrected,
				skippedSuggestions: usedOriginal,
				processingTimeMs
			},
			segmentDetails
		};
	} catch (error) {
		const processingTimeMs = Date.now() - startTime;
		console.error('Corrected segments export failed:', error);

		return {
			success: false,
			exportStats: {
				totalSegments: 0,
				totalSuggestions: 0,
				appliedSuggestions: 0,
				skippedSuggestions: 0,
				processingTimeMs
			},
			segmentDetails: [],
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Export transcript using WER-focused corrections from TranscriptCorrection table
 * Removes speaker names for clean WER calculation
 */
export function exportWithWERCorrections(
	transcriptCorrections: TranscriptCorrection[]
): BenchmarkExportResult {
	const startTime = Date.now();

	try {
		console.log(`Starting WER corrections export for ${transcriptCorrections.length} blocks`);

		// Filter only completed corrections, sorted by block index
		const completedCorrections = transcriptCorrections
			.filter((tc) => tc.status === 'completed' && tc.correctedText)
			.sort((a, b) => a.blockIndex - b.blockIndex);

		if (completedCorrections.length === 0) {
			throw new Error('No completed corrections found');
		}

		console.log(`Using ${completedCorrections.length} completed correction blocks`);

		// Concatenate all corrected blocks
		const correctedBlocks = completedCorrections.map((tc) => tc.correctedText!);

		// Remove speaker names from the text
		// Speaker names are in format "Speaker Name: text"
		const plainTextBlocks = correctedBlocks.map((block) => {
			return block
				.split('\n')
				.map((line) => {
					// Remove speaker names (everything before first colon and space)
					const colonIndex = line.indexOf(': ');
					if (colonIndex > 0) {
						return line.substring(colonIndex + 2);
					}
					// Skip lines that are just "Alternatives: ..."
					if (line.startsWith('Alternatives: ')) {
						return '';
					}
					return line;
				})
				.filter((line) => line.trim().length > 0) // Remove empty lines
				.join(' '); // Join lines with spaces
		});

		// Join all blocks with newlines
		const plainText = plainTextBlocks.filter((block) => block.trim().length > 0).join('\n');

		// Calculate statistics
		const totalCorrections = completedCorrections.reduce((sum, tc) => {
			const suggestions = Array.isArray(tc.suggestions) ? tc.suggestions : [];
			return sum + suggestions.length;
		}, 0);

		const processingTimeMs = Date.now() - startTime;

		console.log('WER corrections export completed:', {
			totalBlocks: transcriptCorrections.length,
			completedBlocks: completedCorrections.length,
			totalCorrections,
			processingTimeMs,
			textLength: plainText.length
		});

		// Create segment details for compatibility
		const segmentDetails = completedCorrections.map((tc, index) => ({
			segmentIndex: tc.blockIndex,
			originalText: tc.originalText
				? removeSpeakerNames(tc.originalText).substring(0, 100) + '...'
				: 'N/A',
			modifiedText: tc.correctedText
				? removeSpeakerNames(tc.correctedText).substring(0, 100) + '...'
				: 'N/A',
			suggestionsApplied: Array.isArray(tc.suggestions) ? tc.suggestions.length : 0,
			suggestionsSkipped: 0
		}));

		return {
			success: true,
			plainText,
			fileName: `wer_corrected_transcript_${Date.now()}.txt`,
			exportStats: {
				totalSegments: completedCorrections.length,
				totalSuggestions: totalCorrections,
				appliedSuggestions: totalCorrections,
				skippedSuggestions: 0,
				processingTimeMs
			},
			segmentDetails
		};
	} catch (error) {
		const processingTimeMs = Date.now() - startTime;
		console.error('WER corrections export failed:', error);

		return {
			success: false,
			exportStats: {
				totalSegments: 0,
				totalSuggestions: 0,
				appliedSuggestions: 0,
				skippedSuggestions: 0,
				processingTimeMs
			},
			segmentDetails: [],
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Remove speaker names from text for WER calculation
 */
function removeSpeakerNames(text: string): string {
	return text
		.split('\n')
		.map((line) => {
			// Remove speaker names (everything before first colon and space)
			const colonIndex = line.indexOf(': ');
			if (colonIndex > 0) {
				return line.substring(colonIndex + 2);
			}
			// Skip lines that are just "Alternatives: ..."
			if (line.startsWith('Alternatives: ')) {
				return '';
			}
			return line;
		})
		.filter((line) => line.trim().length > 0)
		.join(' ');
}

export interface SegmentWithTimestamp {
	start: number;
	end: number;
	text: string;
}

export interface SegmentExportResult {
	success: boolean;
	segments?: SegmentWithTimestamp[];
	exportStats: {
		totalSegments: number;
		totalSuggestions: number;
		appliedSuggestions: number;
		skippedSuggestions: number;
		processingTimeMs: number;
	};
	error?: string;
}

/**
 * Export segments with timestamps and applied corrections as JSON
 * Combines timing information with corrected text for each segment
 */
export async function exportSegmentsWithTimestamps({
	parsedContent,
	analysisSegments,
	werCorrections,
	options
}: {
	parsedContent: TipTapEditorContent;
	analysisSegments: AnalysisSegment[];
	werCorrections: TranscriptCorrection[];
	options: {
		minConfidence?: number;
		applyAll?: boolean;
	};
}): Promise<SegmentExportResult> {
	const startTime = Date.now();
	const { minConfidence = 0.0, applyAll = true } = options;

	try {
		console.log(`Starting segment JSON export for ${analysisSegments.length} analysis segments`);
		console.log(`WER corrections: ${werCorrections.length}`);
		console.log(`Parsed content type:`, typeof parsedContent, parsedContent?.type);

		// Extract speaker segments from editor content
		const segments = extractSpeakerSegments(parsedContent);
		console.log(`Extracted ${segments.length} speaker segments from editor content`);
		
		if (segments.length > 0) {
			console.log(`Sample segment:`, {
				index: segments[0].index,
				startTime: segments[0].startTime,
				endTime: segments[0].endTime,
				textLength: segments[0].text?.length,
				textPreview: segments[0].text?.substring(0, 50) + '...'
			});
		}

		let exportResult: BenchmarkExportResult;
		const outputSegments: SegmentWithTimestamp[] = [];

		// Check for WER corrections first (highest priority)
		if (werCorrections.length > 0) {
			const completedCorrections = werCorrections
				.filter((tc) => tc.status === 'completed' && tc.correctedText)
				.sort((a, b) => a.blockIndex - b.blockIndex);

			console.log(`Using ${completedCorrections.length} completed WER correction blocks`);

			// Process each WER correction block
			for (const correction of completedCorrections) {
				console.log(`Processing WER correction block ${correction.blockIndex}, segmentIndices:`, correction.segmentIndices);
				
				// Get segments for this block
				const blockSegments = correction.segmentIndices
					.map((idx) => analysisSegments.find((seg) => seg.segmentIndex === idx))
					.filter((seg): seg is AnalysisSegment => seg !== undefined)
					.sort((a, b) => a.segmentIndex - b.segmentIndex);

				console.log(`Found ${blockSegments.length} segments for block ${correction.blockIndex}`);

				if (blockSegments.length > 0) {
					// Clean the corrected text (remove speaker names)
					const cleanText = removeSpeakerNames(correction.correctedText || '');
					console.log(`Block ${correction.blockIndex} clean text length:`, cleanText.trim().length);
					
					// Use timing from first and last segment in the block
					const startTime = blockSegments[0].startTime;
					const endTime = blockSegments[blockSegments.length - 1].endTime;

					if (cleanText.trim()) {
						outputSegments.push({
							start: startTime,
							end: endTime,
							text: cleanText.trim()
						});
						console.log(`Added segment: ${startTime}s-${endTime}s, text: ${cleanText.trim().substring(0, 50)}...`);
					}
				}
			}

			// Create dummy export stats for WER corrections
			exportResult = {
				success: true,
				exportStats: {
					totalSegments: completedCorrections.length,
					totalSuggestions: completedCorrections.reduce((sum, tc) => {
						const suggestions = Array.isArray(tc.suggestions) ? tc.suggestions : [];
						return sum + suggestions.length;
					}, 0),
					appliedSuggestions: outputSegments.length,
					skippedSuggestions: 0,
					processingTimeMs: Date.now() - startTime
				},
				segmentDetails: [],
				plainText: '' // Not used for JSON export
			};
		} else {
			// Fallback to existing logic for backward compatibility
			const segmentsWithCorrectedText = analysisSegments.filter((seg) => seg.correctedSegment);
			const useCorrectedSegments = segmentsWithCorrectedText.length > 0;

			console.log(`Export method: ${useCorrectedSegments ? 'corrected segments' : 'suggestion application'}`);

			// Choose export method based on availability of corrected segments
			exportResult = useCorrectedSegments
				? exportWithCorrectedSegments(parsedContent, analysisSegments)
				: exportWithSuggestionsApplied(parsedContent, analysisSegments, {
						minConfidence,
						applyAll,
						includeStats: true
				});

			if (!exportResult.success) {
				throw new Error(exportResult.error || 'Export failed');
			}

			// Process each analysis segment to create timestamped segments
			for (const analysisSegment of analysisSegments) {
				const segment = segments.find((s) => s.index === analysisSegment.segmentIndex);
				if (!segment) continue;

				let segmentText = '';

				if (useCorrectedSegments && analysisSegment.correctedSegment) {
					// Use the corrected segment text
					segmentText = analysisSegment.correctedSegment.trim();
				} else if (analysisSegment.status === 'analyzed' && analysisSegment.suggestions) {
					// Apply suggestions to the original segment text (only for analyzed segments with suggestions)
					const suggestions = analysisSegment.suggestions;
					let parsedSuggestions: any[] = [];

					try {
						if (typeof suggestions === 'string') {
							parsedSuggestions = JSON.parse(suggestions);
						} else if (Array.isArray(suggestions)) {
							parsedSuggestions = suggestions;
						} else if (suggestions && typeof suggestions === 'object' && 'suggestions' in suggestions) {
							const wrapped = suggestions as any;
							if (Array.isArray(wrapped.suggestions)) {
								parsedSuggestions = wrapped.suggestions;
							}
						}
					} catch (error) {
						console.error(`Error parsing suggestions for segment ${analysisSegment.segmentIndex}:`, error);
					}

					// Apply suggestions to segment text
					const result = applySegmentSuggestions(segment.text, parsedSuggestions, {
						minConfidence,
						applyAll
					});

					segmentText = result.modifiedText.trim();
				} else {
					// For segments without analysis/suggestions, use the original text
					segmentText = segment.text.trim();
				}

				if (segmentText) {
					outputSegments.push({
						start: analysisSegment.startTime,
						end: analysisSegment.endTime,
						text: segmentText
					});
				}
			}
		}

		// Sort segments by start time to ensure proper order
		outputSegments.sort((a, b) => a.start - b.start);

		const processingTimeMs = Date.now() - startTime;

		console.log('Segment JSON export completed:', {
			totalSegments: outputSegments.length,
			stats: exportResult.exportStats,
			processingTimeMs
		});

		if (outputSegments.length === 0) {
			console.error('WARNING: No segments were generated. This indicates a problem in segment processing.');
			console.log('Debug info:', {
				werCorrectionsLength: werCorrections.length,
				analysisSegmentsLength: analysisSegments.length,
				parsedContentType: typeof parsedContent,
				hasContent: !!parsedContent,
				contentKeys: parsedContent ? Object.keys(parsedContent) : 'null'
			});
		}

		return {
			success: true,
			segments: outputSegments,
			exportStats: {
				...exportResult.exportStats,
				processingTimeMs
			}
		};
	} catch (error) {
		const processingTimeMs = Date.now() - startTime;
		console.error('Segment JSON export failed:', error);

		return {
			success: false,
			exportStats: {
				totalSegments: 0,
				totalSuggestions: 0,
				appliedSuggestions: 0,
				skippedSuggestions: 0,
				processingTimeMs
			},
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
