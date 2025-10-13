/**
 * Create Diff Nodes from Alignments
 *
 * Converts stored transcript corrections (word-level alignments) into
 * TipTap diff nodes for inline review and approval.
 */

import type { Editor } from '@tiptap/core';
import type { TipTapEditorContent } from '../../types';
import { extractSegmentsFromEditor, type SegmentWithTiming } from './extractWordsFromEditor';
import { alignWords, type WordAlignment } from './textAlignment';
import { getTimingPluginState } from '../components/plugins/wordTimingPlugin';

export interface SegmentAlignment {
	segmentIndex: number;
	startWordIndex: number;
	endWordIndex: number;
	originalText: string;
	correctedText: string;
}

export interface CorrectionBlock {
	blockIndex: number;
	segmentIndices: number[];
	originalText: string;
	correctedText: string;
	suggestions: any;
	status: string;
}

/**
 * Split text into words (same tokenization as applyAlignedCorrections)
 */
function tokenizeText(text: string): string[] {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0);
}

/**
 * Find the position of a word in the editor document using wordIndex
 *
 * This uses the WordTimingPlugin's wordPositionMap for O(1) lookup.
 *
 * @param editor - TipTap editor instance
 * @param wordIndex - Index in the timingArray (from ExtractedWord.wordIndex)
 * @returns Position range {from, to} or null if not found
 */
function findWordPositionByIndex(
	editor: Editor,
	wordIndex: number | undefined
): { from: number; to: number } | null {
	if (wordIndex === undefined || wordIndex === null) {
		return null;
	}

	// Get the WordTimingPlugin state
	const pluginState = getTimingPluginState(editor);
	if (!pluginState || !pluginState.wordPositionMap) {
		console.warn('[findWordPositionByIndex] WordTimingPlugin not available');
		return null;
	}

	// Look up position from the map (O(1) lookup)
	const pos = pluginState.wordPositionMap.get(wordIndex);
	if (pos === undefined) {
		return null;
	}

	// Get the node at this position to determine its size
	const node = editor.state.doc.nodeAt(pos);
	if (!node) {
		return null;
	}

	return {
		from: pos,
		to: pos + node.nodeSize
	};
}

/**
 * Parse segment alignments from correction block's suggestions field
 */
function parseSegmentAlignments(correctionBlock: CorrectionBlock): SegmentAlignment[] {
	// The suggestions field contains the alignment data
	const suggestions = correctionBlock.suggestions;

	if (Array.isArray(suggestions)) {
		return suggestions.map((seg: any) => ({
			segmentIndex: seg.segmentIndex || 0,
			startWordIndex: seg.startWordIndex || 0,
			endWordIndex: seg.endWordIndex || 0,
			originalText: seg.originalText || '',
			correctedText: seg.correctedText || ''
		}));
	}

	// Fallback: create single alignment from block data
	if (correctionBlock.segmentIndices && correctionBlock.segmentIndices.length > 0) {
		return [
			{
				segmentIndex: correctionBlock.segmentIndices[0],
				startWordIndex: 0,
				endWordIndex: 0,
				originalText: correctionBlock.originalText,
				correctedText: correctionBlock.correctedText
			}
		];
	}

	return [];
}

/**
 * Create diff nodes from word alignments within a segment
 */
function createDiffNodesForSegment(
	editor: Editor,
	segment: SegmentWithTiming,
	segmentAlignment: SegmentAlignment
): void {
	// Space filtering already done in extractSegmentsFromEditor
	const originalWords = segment.words.map((w) => w.text);
	const correctedWords = tokenizeText(segmentAlignment.correctedText);

	console.log(
		`[CreateDiffNodes] Segment ${segment.index}: ${originalWords.length} words -> ${correctedWords.length} corrected words`
	);

	// Debug: show first 10 words of original vs corrected
	console.log('[CreateDiffNodes] Original words (first 10):', originalWords.slice(0, 10));
	console.log('[CreateDiffNodes] Corrected words (first 10):', correctedWords.slice(0, 10));

	// Align words to get operations
	const wordAlignments = alignWords(originalWords, correctedWords);

	// Create diff nodes in reverse order to maintain positions
	const diffsToCreate: Array<{
		pos: { from: number; to: number };
		operation: string;
		originalWord: string;
		correctedWord: string;
		wordIndex: number;
	}> = [];

	for (const wordAlign of wordAlignments) {
		if (wordAlign.operation === 'match') {
			// No diff needed for exact matches
			continue;
		}

		// Handle insertions - find position after previous word or before next word
		if (wordAlign.operation === 'insert') {
			// TODO: Handle insertions properly
			console.log(`[CreateDiffNodes] Skipping insertion: "${wordAlign.correctedWord}" (not yet supported)`);
			continue;
		}

		// Map filtered word index back to editor word index
		const editorWordIndex = editorIndexMap[wordAlign.originalIndex];
		if (editorWordIndex === undefined) {
			console.warn(
				`[CreateDiffNodes] No editor index mapping for word ${wordAlign.originalIndex}`
			);
			continue;
		}

		const wordPos = findWordPosition(editor, segment.index, editorWordIndex);

		if (!wordPos) {
			console.warn(
				`[CreateDiffNodes] Could not find position for word at segment ${segment.index}, editor index ${editorWordIndex}`
			);
			continue;
		}

		// Skip if both original and corrected are empty
		const originalWord = wordAlign.originalWord || '';
		const correctedWord = wordAlign.correctedWord || '';

		if (!originalWord && !correctedWord) {
			console.warn(
				`[CreateDiffNodes] Skipping empty diff at segment ${segment.index}, index ${wordAlign.originalIndex}`
			);
			continue;
		}

		console.log(
			`[CreateDiffNodes] Word ${wordAlign.originalIndex} (editor ${editorWordIndex}): "${originalWord}" → "${correctedWord}" at pos ${wordPos.from}-${wordPos.to}`
		);

		diffsToCreate.push({
			pos: wordPos,
			operation: wordAlign.operation,
			originalWord,
			correctedWord,
			wordIndex: wordAlign.originalIndex
		});
	}

	// Group diffs by position to avoid duplicates
	const uniqueDiffs = new Map<string, typeof diffsToCreate[0]>();
	for (const diff of diffsToCreate) {
		const key = `${diff.pos.from}-${diff.pos.to}`;
		if (!uniqueDiffs.has(key)) {
			uniqueDiffs.set(key, diff);
		}
	}

	console.log(`[CreateDiffNodes] Creating ${uniqueDiffs.size} unique diffs (filtered from ${diffsToCreate.length})`);

	// Apply diffs in reverse order (last to first) to maintain positions
	const uniqueDiffsArray = Array.from(uniqueDiffs.values());

	// Sort by position (descending) to go from end to start
	uniqueDiffsArray.sort((a, b) => b.pos.from - a.pos.from);

	for (const diff of uniqueDiffsArray) {
		const diffId = `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		let changeType = 'substitution';
		let originalText = diff.originalWord;
		let suggestedText = diff.correctedWord;

		if (diff.operation === 'delete') {
			changeType = 'deletion';
			suggestedText = ''; // No suggested text for deletions
		} else if (diff.operation === 'insert') {
			changeType = 'insertion';
			originalText = ''; // No original text for insertions
		}

		// Create diff node at the word's position
		console.log(
			`[CreateDiffNodes] Creating ${changeType} diff at ${diff.pos.from}-${diff.pos.to}:`,
			`"${originalText}" → "${suggestedText}"`
		);

		try {
			editor
				.chain()
				.focus()
				.deleteRange({ from: diff.pos.from, to: diff.pos.to })
				.insertContentAt(diff.pos.from, {
					type: 'diff',
					attrs: {
						id: diffId,
						originalText,
						suggestedText,
						changeType,
						confidence: 0.8 // Default confidence
					}
				})
				.run();
		} catch (error) {
			console.warn(
				`[CreateDiffNodes] Failed to create diff at ${diff.pos.from}-${diff.pos.to}:`,
				error
			);
		}
	}
}

/**
 * Main function: Create diff nodes from correction blocks
 *
 * @param editor - TipTap editor instance
 * @param editorContent - Current editor content (TipTap JSON)
 * @param correctionBlocks - Correction blocks from database
 */
export function createDiffNodesFromCorrections(
	editor: Editor,
	editorContent: TipTapEditorContent,
	correctionBlocks: CorrectionBlock[]
): void {
	console.log(`[CreateDiffNodes] Creating diff nodes from ${correctionBlocks.length} correction blocks`);

	// Extract segments from editor content
	const segments = extractSpeakerSegments(editorContent);

	if (segments.length === 0) {
		console.warn('[CreateDiffNodes] No segments found in editor content');
		return;
	}

	console.log(`[CreateDiffNodes] Found ${segments.length} segments in editor`);

	// Process each correction block
	for (const block of correctionBlocks) {
		if (block.status !== 'completed') {
			continue;
		}

		// Parse segment alignments from the block
		const segmentAlignments = parseSegmentAlignments(block);

		console.log(
			`[CreateDiffNodes] Block ${block.blockIndex}: ${segmentAlignments.length} segment alignments`
		);

		// Create diff nodes for each segment alignment
		for (const segmentAlignment of segmentAlignments) {
			const segment = segments.find((s) => s.index === segmentAlignment.segmentIndex);

			if (!segment) {
				console.warn(
					`[CreateDiffNodes] Segment ${segmentAlignment.segmentIndex} not found in editor`
				);
				continue;
			}

			// Check if this segment actually has corrections
			if (segmentAlignment.originalText === segmentAlignment.correctedText) {
				console.log(`[CreateDiffNodes] Segment ${segment.index}: No changes, skipping`);
				continue;
			}

			// Create diff nodes for this segment
			createDiffNodesForSegment(editor, segment, segmentAlignment);
		}
	}

	console.log('[CreateDiffNodes] Finished creating diff nodes');
}
