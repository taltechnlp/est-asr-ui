/**
 * Text Alignment Utility
 *
 * Provides word-level sequence alignment between original and corrected text.
 * Ported from agno-agent's align_trs_txt_*.py scripts.
 *
 * Uses dynamic programming (Wagner-Fischer algorithm) to find optimal alignment
 * that minimizes edit distance while preserving word-level mappings.
 */

/**
 * Cache for normalized text to avoid repeated normalization
 */
const normalizeCache = new Map<string, string>();

/**
 * Cache for Levenshtein distance calculations
 */
const levenshteinCache = new Map<string, number>();

/**
 * Normalize text for comparison: lowercase and collapse whitespace
 */
export function normalizeText(text: string): string {
	if (normalizeCache.has(text)) {
		return normalizeCache.get(text)!;
	}

	const normalized = text.toLowerCase().split(/\s+/).filter(w => w.length > 0).join(' ');
	normalizeCache.set(text, normalized);
	return normalized;
}

/**
 * Calculate Levenshtein distance between two strings with caching
 */
export function levenshteinDistance(s1: string, s2: string): number {
	const cacheKey = `${s1}|${s2}`;
	if (levenshteinCache.has(cacheKey)) {
		return levenshteinCache.get(cacheKey)!;
	}

	// Swap to ensure s1 is shorter for efficiency
	if (s1.length > s2.length) {
		return levenshteinDistance(s2, s1);
	}

	if (s2.length === 0) {
		return s1.length;
	}

	// Use single array optimization (Wagner-Fischer algorithm)
	let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);

	for (let i = 0; i < s1.length; i++) {
		const currentRow = [i + 1];

		for (let j = 0; j < s2.length; j++) {
			const insertCost = previousRow[j + 1] + 1;
			const deleteCost = currentRow[j] + 1;
			const replaceCost = previousRow[j] + (s1[i] === s2[j] ? 0 : 1);

			currentRow.push(Math.min(insertCost, deleteCost, replaceCost));
		}

		previousRow = currentRow;
	}

	const distance = previousRow[s2.length];
	levenshteinCache.set(cacheKey, distance);
	return distance;
}

/**
 * Alignment result mapping original words to corrected words
 */
export interface WordAlignment {
	originalIndex: number;  // Index in original word array (-1 for insertions)
	correctedIndex: number; // Index in corrected word array (-1 for deletions)
	operation: 'match' | 'substitute' | 'insert' | 'delete';
	originalWord?: string;
	correctedWord?: string;
}

/**
 * Align two word arrays using dynamic programming
 * Returns array of alignment operations showing how words map between arrays
 *
 * @param originalWords - Original word array
 * @param correctedWords - Corrected word array
 * @param caseSensitive - If true, compare words case-sensitively (default: false for case-insensitive)
 */
export function alignWords(
	originalWords: string[],
	correctedWords: string[],
	caseSensitive: boolean = false
): WordAlignment[] {
	const n = originalWords.length;
	const m = correctedWords.length;

	// Normalize words for comparison (optionally case-sensitive)
	const origNorm = caseSensitive
		? originalWords.map(w => w.trim())
		: originalWords.map(w => normalizeText(w));
	const corrNorm = caseSensitive
		? correctedWords.map(w => w.trim())
		: correctedWords.map(w => normalizeText(w));

	// Initialize DP table
	// dp[i][j] = minimum edit distance to align original[0..i) with corrected[0..j)
	const dp: number[][] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(Infinity));

	// Base cases
	for (let i = 0; i <= n; i++) {
		dp[i][0] = i; // Delete all original words
	}
	for (let j = 0; j <= m; j++) {
		dp[0][j] = j; // Insert all corrected words
	}

	// Fill DP table
	for (let i = 1; i <= n; i++) {
		for (let j = 1; j <= m; j++) {
			const cost = origNorm[i - 1] === corrNorm[j - 1] ? 0 : 1;
			dp[i][j] = Math.min(
				dp[i - 1][j - 1] + cost,  // Match or substitute
				dp[i - 1][j] + 1,          // Delete from original
				dp[i][j - 1] + 1           // Insert from corrected
			);
		}
	}

	// Backtrack to find alignment operations
	const alignments: WordAlignment[] = [];
	let i = n;
	let j = m;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0) {
			const cost = origNorm[i - 1] === corrNorm[j - 1] ? 0 : 1;

			if (dp[i][j] === dp[i - 1][j - 1] + cost) {
				// Match or substitute
				alignments.unshift({
					originalIndex: i - 1,
					correctedIndex: j - 1,
					operation: cost === 0 ? 'match' : 'substitute',
					originalWord: originalWords[i - 1],
					correctedWord: correctedWords[j - 1]
				});
				i--;
				j--;
			} else if (dp[i][j] === dp[i - 1][j] + 1) {
				// Delete from original
				alignments.unshift({
					originalIndex: i - 1,
					correctedIndex: -1,
					operation: 'delete',
					originalWord: originalWords[i - 1]
				});
				i--;
			} else {
				// Insert from corrected
				alignments.unshift({
					originalIndex: -1,
					correctedIndex: j - 1,
					operation: 'insert',
					correctedWord: correctedWords[j - 1]
				});
				j--;
			}
		} else if (i > 0) {
			// Only original words left - delete them
			alignments.unshift({
				originalIndex: i - 1,
				correctedIndex: -1,
				operation: 'delete',
				originalWord: originalWords[i - 1]
			});
			i--;
		} else {
			// Only corrected words left - insert them
			alignments.unshift({
				originalIndex: -1,
				correctedIndex: j - 1,
				operation: 'insert',
				correctedWord: correctedWords[j - 1]
			});
			j--;
		}
	}

	return alignments;
}

/**
 * Segment with timing information
 */
export interface TimedSegment {
	index: number;
	startTime: number;
	endTime: number;
	text: string;
	speakerTag?: string;
}

/**
 * Segment alignment result mapping original segments to corrected text
 */
export interface SegmentAlignment {
	segmentIndex: number;
	startWordIndex: number;  // Start index in corrected word array
	endWordIndex: number;    // End index (exclusive) in corrected word array
	originalText: string;
	correctedText: string;
}

/**
 * Align corrected text to original segments
 * Distributes corrected words across segments based on word-level alignment
 *
 * @param originalSegments - Original segments with timing
 * @param correctedText - Corrected text from LLM
 * @returns Array of segment alignments showing word distribution
 */
export function alignSegments(
	originalSegments: TimedSegment[],
	correctedText: string
): SegmentAlignment[] {
	// Extract all words from original segments
	const originalWords: string[] = [];
	const segmentBoundaries: number[] = [0]; // Start position of each segment in word array

	for (const segment of originalSegments) {
		const words = normalizeText(segment.text).split(/\s+/).filter(w => w.length > 0);
		originalWords.push(...words);
		segmentBoundaries.push(originalWords.length);
	}

	// Split corrected text into words (keep both original and normalized)
	const correctedWordsOriginal = correctedText.trim().split(/\s+/).filter(w => w.length > 0);
	const correctedWordsNormalized = normalizeText(correctedText).split(/\s+/).filter(w => w.length > 0);

	// Align words using normalized versions
	const wordAlignments = alignWords(originalWords, correctedWordsNormalized);

	// Map corrected words back to segments
	const segmentAssignments: number[][] = originalSegments.map(() => []);

	for (const alignment of wordAlignments) {
		if (alignment.correctedIndex >= 0 && alignment.originalIndex >= 0) {
			// Find which segment the original word belongs to
			const segmentIndex = segmentBoundaries.findIndex((boundary, idx) => {
				if (idx === segmentBoundaries.length - 1) return false;
				return alignment.originalIndex >= boundary &&
				       alignment.originalIndex < segmentBoundaries[idx + 1];
			});

			if (segmentIndex >= 0 && segmentIndex < segmentAssignments.length) {
				segmentAssignments[segmentIndex].push(alignment.correctedIndex);
			}
		} else if (alignment.correctedIndex >= 0) {
			// Inserted word - assign to nearest segment with content
			const nearestSegment = segmentAssignments.findIndex(seg => seg.length > 0);
			if (nearestSegment >= 0) {
				segmentAssignments[nearestSegment].push(alignment.correctedIndex);
			}
		}
	}

	// Create segment alignments
	const result: SegmentAlignment[] = [];

	for (let i = 0; i < originalSegments.length; i++) {
		const segment = originalSegments[i];
		const assignedIndices = segmentAssignments[i];

		if (assignedIndices.length > 0) {
			// Sort indices and get range
			assignedIndices.sort((a, b) => a - b);
			const startIdx = Math.min(...assignedIndices);
			const endIdx = Math.max(...assignedIndices) + 1;

			// Extract corrected text for this segment (use ORIGINAL case, not normalized)
			const segmentCorrectedWords = correctedWordsOriginal.slice(startIdx, endIdx);
			const correctedTextForSegment = segmentCorrectedWords.join(' ');

			result.push({
				segmentIndex: segment.index,
				startWordIndex: startIdx,
				endWordIndex: endIdx,
				originalText: segment.text,
				correctedText: correctedTextForSegment
			});
		} else {
			// No words assigned - segment might be deleted or empty
			result.push({
				segmentIndex: segment.index,
				startWordIndex: 0,
				endWordIndex: 0,
				originalText: segment.text,
				correctedText: ''
			});
		}
	}

	return result;
}

/**
 * Calculate alignment quality metrics
 */
export interface AlignmentMetrics {
	totalWords: number;
	matches: number;
	substitutions: number;
	insertions: number;
	deletions: number;
	editDistance: number;
	similarity: number; // 0-1, higher is better
}

/**
 * Calculate metrics for an alignment
 */
export function calculateAlignmentMetrics(alignments: WordAlignment[]): AlignmentMetrics {
	const metrics: AlignmentMetrics = {
		totalWords: 0,
		matches: 0,
		substitutions: 0,
		insertions: 0,
		deletions: 0,
		editDistance: 0,
		similarity: 0
	};

	for (const alignment of alignments) {
		if (alignment.operation === 'match') {
			metrics.matches++;
		} else if (alignment.operation === 'substitute') {
			metrics.substitutions++;
			metrics.editDistance++;
		} else if (alignment.operation === 'insert') {
			metrics.insertions++;
			metrics.editDistance++;
		} else if (alignment.operation === 'delete') {
			metrics.deletions++;
			metrics.editDistance++;
		}
	}

	metrics.totalWords = metrics.matches + metrics.substitutions + metrics.deletions;

	if (metrics.totalWords > 0) {
		metrics.similarity = 1.0 - (metrics.editDistance / metrics.totalWords);
	} else {
		metrics.similarity = 0;
	}

	return metrics;
}

/**
 * Clear alignment caches (useful for testing or memory management)
 */
export function clearAlignmentCaches(): void {
	normalizeCache.clear();
	levenshteinCache.clear();
}
