/**
 * Service for applying ASR correction suggestions and exporting plain text for benchmarking
 * Creates a clean copy of the transcript with all suggestions applied
 */

import type { AnalysisSegment } from '@prisma/client';
import { applySuggestionsToSegments, cleanTextForExport, type Suggestion } from './suggestionApplier';
import { extractFullTextWithSpeakers } from '$lib/utils/extractWordsFromEditor';
import { extractSpeakerSegments } from '$lib/utils/extractWordsFromEditor';

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
 * Extract plain text segments from editor JSON content
 * Handles both new ASR format and TipTap editor format
 */
export function extractPlainTextSegments(editorContent: any): Array<{
	index: number;
	text: string;
	speakerName?: string;
}> {
	const segments: Array<{ index: number; text: string; speakerName?: string }> = [];

	try {
		// Handle TipTap editor format (type: 'doc', content: [...])
		if (editorContent && editorContent.type === 'doc' && editorContent.content) {
			// Extract segments using existing utility
			const speakerSegments = extractSpeakerSegments(editorContent);
			
			return speakerSegments.map((segment, index) => ({
				index: segment.index,
				text: segment.text,
				speakerName: segment.speakerName
			}));
		}

		// Check if it might be ASR format with sections and turns
		if (editorContent && editorContent.best_hypothesis && editorContent.best_hypothesis.sections) {
			const sections = editorContent.best_hypothesis.sections || [];
			let segmentIndex = 0;
			
			sections.forEach((section) => {
				if (section.type === 'speech' && section.turns) {
					section.turns.forEach((turn) => {
						if (turn.transcript) {
							segments.push({
								index: segmentIndex++,
								text: turn.transcript,
								speakerName: editorContent.best_hypothesis.speakers?.[turn.speaker]?.name || turn.speaker
							});
						}
					});
				}
			});
			return segments;
		}

		// Handle raw text or other formats
		if (typeof editorContent === 'string') {
			segments.push({
				index: 0,
				text: editorContent,
				speakerName: 'Unknown Speaker'
			});
		} else if (editorContent && typeof editorContent === 'object') {
			// Try to extract text from any object structure
			const text = JSON.stringify(editorContent);
			segments.push({
				index: 0,
				text: text,
				speakerName: 'Unknown Speaker'
			});
		}

		return segments;
	} catch (error) {
		console.error('Error extracting plain text segments:', error);
		return [{
			index: 0,
			text: 'Error extracting text content',
			speakerName: 'Error'
		}];
	}
}

/**
 * Convert AnalysisSegment suggestions to Suggestion format
 */
export function convertAnalysisSegmentSuggestions(analysisSegments: AnalysisSegment[]): Map<number, Suggestion[]> {
	const segmentSuggestions = new Map<number, Suggestion[]>();

	for (const segment of analysisSegments) {
		try {
			const suggestions: Suggestion[] = [];
			
			// Parse suggestions JSON
			let parsedSuggestions = segment.suggestions;
			if (typeof parsedSuggestions === 'string') {
				parsedSuggestions = JSON.parse(parsedSuggestions);
			}

			// Handle both array format and object format
			let suggestionArray: any[] = [];
			if (Array.isArray(parsedSuggestions)) {
				suggestionArray = parsedSuggestions;
			} else if (parsedSuggestions && Array.isArray(parsedSuggestions.suggestions)) {
				// Handle wrapped format: { suggestions: [...] }
				suggestionArray = parsedSuggestions.suggestions;
			}

			for (const rawSuggestion of suggestionArray) {
				if (rawSuggestion.originalText && rawSuggestion.suggestedText) {
					suggestions.push({
						originalText: rawSuggestion.originalText,
						suggestedText: rawSuggestion.suggestedText,
						confidence: rawSuggestion.confidence || 0.5,
						from: rawSuggestion.from,
						to: rawSuggestion.to,
						segmentIndex: segment.segmentIndex,
						shouldAutoApply: rawSuggestion.shouldAutoApply !== false
					});
				}
			}

			if (suggestions.length > 0) {
				segmentSuggestions.set(segment.segmentIndex, suggestions);
			}
		} catch (error) {
			console.error(`Error parsing suggestions for segment ${segment.segmentIndex}:`, error);
		}
	}

	return segmentSuggestions;
}

/**
 * Apply all ASR correction suggestions to editor content and export as plain text
 */
export function exportWithSuggestionsApplied(
	editorContent: any,
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
		// Extract plain text segments from editor content
		const textSegments = extractPlainTextSegments(editorContent);
		console.log(`Extracted ${textSegments.length} text segments from editor content`);

		// Convert analysis segments to suggestions map
		const segmentSuggestionsMap = convertAnalysisSegmentSuggestions(analysisSegments);
		console.log(`Found suggestions for ${segmentSuggestionsMap.size} segments`);

		// Prepare segments with their suggestions
		const segmentsWithSuggestions = textSegments.map(textSegment => ({
			text: textSegment.text,
			suggestions: segmentSuggestionsMap.get(textSegment.index) || []
		}));

		// Apply suggestions to all segments
		const applyResult = applySuggestionsToSegments(segmentsWithSuggestions, {
			minConfidence,
			applyAll
		});

		// Clean and join segments for export (no speaker names, just text)
		const cleanedSegments = applyResult.modifiedSegments.map(text => cleanTextForExport(text));
		const plainText = cleanedSegments.filter(text => text.length > 0).join('\n');

		// Generate detailed statistics
		const segmentDetails = textSegments.map((segment, index) => ({
			segmentIndex: segment.index,
			originalText: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
			modifiedText: applyResult.modifiedSegments[index]?.substring(0, 100) + 
						 (applyResult.modifiedSegments[index]?.length > 100 ? '...' : ''),
			suggestionsApplied: applyResult.segmentResults[index]?.appliedCount || 0,
			suggestionsSkipped: applyResult.segmentResults[index]?.skippedCount || 0
		}));

		const processingTimeMs = Date.now() - startTime;

		console.log('Benchmark export completed:', {
			totalSegments: textSegments.length,
			totalSuggestions: analysisSegments.reduce((sum, seg) => {
				try {
					const parsed = typeof seg.suggestions === 'string' ? 
								   JSON.parse(seg.suggestions) : seg.suggestions;
					return sum + (Array.isArray(parsed) ? parsed.length : 
								 (parsed?.suggestions?.length || 0));
				} catch {
					return sum;
				}
			}, 0),
			appliedSuggestions: applyResult.totalApplied,
			skippedSuggestions: applyResult.totalSkipped,
			processingTimeMs
		});

		return {
			success: true,
			plainText,
			fileName: `corrected_transcript_${Date.now()}.txt`,
			exportStats: {
				totalSegments: textSegments.length,
				totalSuggestions: analysisSegments.reduce((sum, seg) => {
					try {
						const parsed = typeof seg.suggestions === 'string' ? 
									   JSON.parse(seg.suggestions) : seg.suggestions;
						return sum + (Array.isArray(parsed) ? parsed.length : 
									 (parsed?.suggestions?.length || 0));
					} catch {
						return sum;
					}
				}, 0),
				appliedSuggestions: applyResult.totalApplied,
				skippedSuggestions: applyResult.totalSkipped,
				processingTimeMs
			},
			segmentDetails
		};

	} catch (error) {
		const processingTimeMs = Date.now() - startTime;
		console.error('Benchmark export failed:', error);

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
	const successRate = stats.totalSuggestions > 0 ? 
		((stats.appliedSuggestions / stats.totalSuggestions) * 100).toFixed(1) : 
		'0';

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