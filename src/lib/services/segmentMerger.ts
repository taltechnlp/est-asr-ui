/**
 * Segment Merger Service
 *
 * Handles automatic merging of speaker segments when LLM corrections
 * suggest removing capitalization at segment boundaries.
 */

import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface SegmentMergeCandidate {
	segmentIndex: number;
	mergeWithPrevious: boolean;
	reason: 'lowercase_start' | 'punctuation_continuation';
	confidence: number;
}

export interface SegmentInfo {
	index: number;
	from: number;
	to: number;
	text: string;
	speakerName: string;
	speakerId: string;
	node: ProseMirrorNode;
}

export interface MergeResult {
	success: boolean;
	mergedCount: number;
	newSegments: SegmentInfo[];
	error?: string;
}

/**
 * Check if text starts with a lowercase letter
 */
function startsWithLowercase(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	const firstChar = trimmed[0];
	return firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase();
}

/**
 * Check if text ends with terminal punctuation that would start new sentence
 */
function endsWithTerminalPunctuation(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	const lastChar = trimmed[trimmed.length - 1];
	return ['.', '!', '?', '…'].includes(lastChar);
}

/**
 * Check if text ends with continuation punctuation
 */
function endsWithContinuation(text: string): boolean {
	const trimmed = text.trim();
	if (trimmed.length === 0) return false;
	const lastChar = trimmed[trimmed.length - 1];
	return [',', ';', ':', '-', '–', '—'].includes(lastChar);
}

/**
 * Detect segments that should be merged based on corrected text
 *
 * @param originalSegments - Original segments from editor
 * @param correctedTextSegments - Corrected text per segment from LLM
 * @returns Array of merge candidates
 */
export function detectSegmentMerges(
	originalSegments: SegmentInfo[],
	correctedTextSegments: string[]
): SegmentMergeCandidate[] {
	const candidates: SegmentMergeCandidate[] = [];

	for (let i = 1; i < originalSegments.length; i++) {
		const currentSegment = originalSegments[i];
		const previousSegment = originalSegments[i - 1];
		const correctedText = correctedTextSegments[i];

		if (!correctedText || correctedText.trim().length === 0) {
			continue;
		}

		// Check if corrected text starts with lowercase (merge signal)
		if (startsWithLowercase(correctedText)) {
			const originalStartsWithUpper = !startsWithLowercase(currentSegment.text);

			// Strong signal: original was uppercase, corrected is lowercase
			if (originalStartsWithUpper) {
				// Additional check: previous segment should not end with terminal punctuation
				const prevEndsWithTerminal = endsWithTerminalPunctuation(previousSegment.text);

				if (!prevEndsWithTerminal) {
					candidates.push({
						segmentIndex: i,
						mergeWithPrevious: true,
						reason: 'lowercase_start',
						confidence: 0.9
					});
					console.log(
						`[SegmentMerger] Detected merge candidate at segment ${i}: ` +
						`"${previousSegment.text.slice(-20)}..." + "${correctedText.slice(0, 20)}..."`
					);
				}
			}
		}

		// Additional heuristic: if previous ends with continuation punctuation
		// and current starts lowercase, also consider merging
		if (
			endsWithContinuation(previousSegment.text) &&
			startsWithLowercase(correctedText)
		) {
			// Only add if not already added
			const alreadyAdded = candidates.some(c => c.segmentIndex === i);
			if (!alreadyAdded) {
				candidates.push({
					segmentIndex: i,
					mergeWithPrevious: true,
					reason: 'punctuation_continuation',
					confidence: 0.7
				});
				console.log(
					`[SegmentMerger] Detected continuation merge at segment ${i}`
				);
			}
		}
	}

	return candidates;
}

/**
 * Extract segment information from editor
 */
export function extractSegments(editor: Editor): SegmentInfo[] {
	const segments: SegmentInfo[] = [];
	const doc = editor.state.doc;
	let segmentIndex = 0;

	doc.nodesBetween(0, doc.content.size, (node, pos) => {
		if (node.type.name === 'speaker') {
			segments.push({
				index: segmentIndex++,
				from: pos,
				to: pos + node.nodeSize,
				text: node.textContent,
				speakerName: node.attrs['data-name'] || 'Unknown',
				speakerId: node.attrs.id || '',
				node
			});
		}
	});

	return segments;
}

/**
 * Merge two consecutive speaker segments in the editor
 *
 * @param editor - TipTap editor instance
 * @param fromSegment - Segment to merge from (will be removed)
 * @param toSegment - Segment to merge into (will be expanded)
 * @returns Success status
 */
export function mergeTwoSegments(
	editor: Editor,
	fromSegment: SegmentInfo,
	toSegment: SegmentInfo
): boolean {
	try {
		console.log(
			`[SegmentMerger] Merging segment ${fromSegment.index} into ${toSegment.index}`
		);

		// Get the content from the segment to be merged
		const fromContent = fromSegment.node.content;

		// Create a transaction to merge segments
		const tr = editor.state.tr;

		// Step 1: Copy content from fromSegment to end of toSegment
		// Insert space between segments if needed
		const toSegmentEnd = toSegment.to - 1; // -1 to insert before closing tag

		// Add a space if the target doesn't end with space
		const toText = toSegment.text;
		const needsSpace = toText.length > 0 && !toText.endsWith(' ');

		if (needsSpace) {
			tr.insertText(' ', toSegmentEnd);
		}

		// Insert the content from the segment being merged
		const insertPos = needsSpace ? toSegmentEnd + 1 : toSegmentEnd;

		// Extract text content and insert it
		// We can't directly copy content due to position shifts, so we use text
		tr.insertText(fromSegment.text, insertPos);

		// Step 2: Delete the now-empty segment
		// Need to recalculate position after insertion
		const deleteFrom = needsSpace ? fromSegment.from + 1 : fromSegment.from;
		const deleteTo = needsSpace ? fromSegment.to + 1 : fromSegment.to;
		tr.delete(deleteFrom, deleteTo);

		// Apply the transaction
		editor.view.dispatch(tr);

		console.log(`[SegmentMerger] Successfully merged segments`);
		return true;
	} catch (error) {
		console.error('[SegmentMerger] Failed to merge segments:', error);
		return false;
	}
}

/**
 * Auto-merge segments based on merge candidates
 *
 * @param editor - TipTap editor instance
 * @param candidates - Array of segments to merge
 * @returns Result with updated segment list
 */
export function autoMergeSegments(
	editor: Editor,
	candidates: SegmentMergeCandidate[]
): MergeResult {
	if (candidates.length === 0) {
		const segments = extractSegments(editor);
		return {
			success: true,
			mergedCount: 0,
			newSegments: segments
		};
	}

	console.log(`[SegmentMerger] Auto-merging ${candidates.length} segment pairs`);

	// Sort candidates by index (descending) to merge from end to start
	// This prevents position shift issues
	const sortedCandidates = [...candidates].sort((a, b) => b.segmentIndex - a.segmentIndex);

	let mergedCount = 0;

	for (const candidate of sortedCandidates) {
		if (!candidate.mergeWithPrevious) continue;

		// Re-extract segments to get fresh positions after previous merges
		const currentSegments = extractSegments(editor);

		const currentSegment = currentSegments[candidate.segmentIndex];
		const previousSegment = currentSegments[candidate.segmentIndex - 1];

		if (!currentSegment || !previousSegment) {
			console.warn(
				`[SegmentMerger] Segment ${candidate.segmentIndex} not found after previous merges`
			);
			continue;
		}

		const success = mergeTwoSegments(editor, currentSegment, previousSegment);
		if (success) {
			mergedCount++;
		}
	}

	// Extract final segment list after all merges
	const finalSegments = extractSegments(editor);

	console.log(
		`[SegmentMerger] Completed auto-merge: ${mergedCount} merges, ` +
		`${finalSegments.length} segments remaining`
	);

	return {
		success: true,
		mergedCount,
		newSegments: finalSegments
	};
}

/**
 * Detect and auto-merge segments based on corrected text
 *
 * @param editor - TipTap editor instance
 * @param correctedTextSegments - Corrected text for each segment
 * @returns Merge result
 */
export function detectAndMergeSegments(
	editor: Editor,
	correctedTextSegments: string[]
): MergeResult {
	try {
		// Extract current segments
		const segments = extractSegments(editor);

		// Detect merge candidates
		const candidates = detectSegmentMerges(segments, correctedTextSegments);

		if (candidates.length === 0) {
			console.log('[SegmentMerger] No merge candidates detected');
			return {
				success: true,
				mergedCount: 0,
				newSegments: segments
			};
		}

		// Auto-merge the candidates
		return autoMergeSegments(editor, candidates);
	} catch (error) {
		console.error('[SegmentMerger] Error in detectAndMergeSegments:', error);
		return {
			success: false,
			mergedCount: 0,
			newSegments: [],
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
