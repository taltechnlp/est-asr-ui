/**
 * Service for applying ASR correction suggestions and exporting plain text for benchmarking
 * Creates a clean copy of the transcript with all suggestions applied
 */

import type { AnalysisSegment } from '@prisma/client';
import { applySuggestionsToJson } from './jsonSuggestionApplier';
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
 * Apply all ASR correction suggestions to editor content and export as plain text
 * This new approach applies suggestions directly to the editor JSON first, then extracts text
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
		console.log(`Starting JSON-based suggestion application for ${analysisSegments.length} segments`);

		// Apply all suggestions directly to the editor JSON structure
		const jsonResult = applySuggestionsToJson(editorContent, analysisSegments, {
			minConfidence,
			applyAll
		});

		console.log(`JSON application result: ${jsonResult.appliedCount} applied, ${jsonResult.skippedCount} skipped`);

		// Extract plain text from the modified JSON
		const segments = extractSpeakerSegments(jsonResult.modifiedContent);
		const plainTextSegments = segments.map(segment => segment.text.trim()).filter(text => text.length > 0);
		const plainText = plainTextSegments.join('\n');

		// Calculate total suggestions for stats
		const totalSuggestions = analysisSegments.reduce((sum, seg) => {
			try {
				const parsed = typeof seg.suggestions === 'string' ? 
							   JSON.parse(seg.suggestions) : seg.suggestions;
				return sum + (Array.isArray(parsed) ? parsed.length : 
							 (parsed?.suggestions?.length || 0));
			} catch {
				return sum;
			}
		}, 0);

		// Generate segment details from original vs modified
		const originalSegments = extractSpeakerSegments(editorContent);
		const segmentDetails = originalSegments.map((originalSegment, index) => {
			const modifiedSegment = segments[index];
			return {
				segmentIndex: originalSegment.index,
				originalText: originalSegment.text.substring(0, 100) + (originalSegment.text.length > 100 ? '...' : ''),
				modifiedText: modifiedSegment ? 
					(modifiedSegment.text.substring(0, 100) + (modifiedSegment.text.length > 100 ? '...' : '')) :
					originalSegment.text.substring(0, 100) + (originalSegment.text.length > 100 ? '...' : ''),
				suggestionsApplied: 0, // We don't track per-segment anymore with JSON approach
				suggestionsSkipped: 0  // We don't track per-segment anymore with JSON approach
			};
		});

		const processingTimeMs = Date.now() - startTime;

		console.log('JSON-based benchmark export completed:', {
			totalSegments: segments.length,
			totalSuggestions,
			appliedSuggestions: jsonResult.appliedCount,
			skippedSuggestions: jsonResult.skippedCount,
			processingTimeMs,
			textLength: plainText.length
		});

		// Log some sample skipped suggestions for debugging
		if (jsonResult.skippedSuggestions.length > 0) {
			console.log('Sample skipped suggestions:');
			jsonResult.skippedSuggestions.slice(0, 5).forEach((skipped, index) => {
				console.log(`${index + 1}. "${skipped.suggestion.originalText}" -> "${skipped.suggestion.suggestedText}" | Reason: ${skipped.reason}`);
			});
		}

		return {
			success: true,
			plainText,
			fileName: `corrected_transcript_${Date.now()}.txt`,
			exportStats: {
				totalSegments: segments.length,
				totalSuggestions,
				appliedSuggestions: jsonResult.appliedCount,
				skippedSuggestions: jsonResult.skippedCount,
				processingTimeMs
			},
			segmentDetails
		};

	} catch (error) {
		const processingTimeMs = Date.now() - startTime;
		console.error('JSON-based benchmark export failed:', error);

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