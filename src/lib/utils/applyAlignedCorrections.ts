/**
 * Apply Aligned Corrections to TipTap Editor Structure
 *
 * Takes corrected text from LLM and applies it back to the TipTap editor structure
 * while preserving all word attributes (timing, speaker, etc.).
 *
 * Uses text alignment to map corrected words to original words, then
 * reconstructs the editor content with corrected text but original metadata.
 */

import type { TipTapEditorContent } from '../../types';
import { extractSpeakerSegments, type ExtractedWord, type SegmentWithTiming } from './extractWordsFromEditor';
import { alignWords, type WordAlignment } from './textAlignment';
import type { SegmentAlignment } from './textAlignment';

/**
 * Editor node structure
 */
interface EditorNode {
	type: string;
	attrs?: {
		'data-name'?: string;
		id?: string;
		topic?: string | null;
		text?: string;
		start?: number;
		end?: number;
		alternatives?: string | Array<{ rank: number; text: string; avg_logprob: number }>;
	};
	content?: EditorNode[];
	text?: string;
	marks?: EditorMark[];
}

interface EditorMark {
	type: string;
	attrs?: {
		start?: number;
		end?: number;
		id?: string;
		lang?: string;
		spellcheck?: string;
	};
}

/**
 * Corrected word with original metadata
 */
interface CorrectedWord {
	text: string;
	start: number;
	end: number;
	speakerTag: string;
	originalIndex: number;
	correctedIndex: number;
	operation: 'match' | 'substitute' | 'insert' | 'delete';
}

/**
 * Split corrected text into words matching Estonian tokenization rules
 */
function tokenizeCorrectedText(text: string): string[] {
	// Split on whitespace but preserve punctuation attachments
	return text
		.trim()
		.split(/\s+/)
		.filter(w => w.length > 0);
}

/**
 * Apply segment alignments to create corrected editor content
 *
 * @param originalContent - Original TipTap editor content
 * @param segmentAlignments - Alignments from correction agent
 * @returns New TipTap editor content with corrections
 */
export function applySegmentAlignments(
	originalContent: TipTapEditorContent,
	segmentAlignments: SegmentAlignment[]
): TipTapEditorContent {
	console.log(`[ApplyAlignedCorrections] Applying ${segmentAlignments.length} segment alignments`);

	// Extract original segments
	const originalSegments = extractSpeakerSegments(originalContent);

	if (originalSegments.length === 0) {
		console.warn('[ApplyAlignedCorrections] No segments found in original content');
		return originalContent;
	}

	// Create alignment lookup by segment index
	const alignmentMap = new Map<number, SegmentAlignment>();
	for (const alignment of segmentAlignments) {
		alignmentMap.set(alignment.segmentIndex, alignment);
	}

	// Build new content with corrections applied
	const newContent: EditorNode[] = [];

	for (const segment of originalSegments) {
		const alignment = alignmentMap.get(segment.index);

		if (!alignment || !alignment.correctedText) {
			// No correction for this segment - keep original
			newContent.push(createSpeakerNode(segment, segment.words));
			continue;
		}

		// Apply correction to this segment
		const correctedWords = applyCorrectionToSegment(segment, alignment);
		newContent.push(createSpeakerNode(segment, correctedWords));
	}

	return {
		type: 'doc',
		content: newContent as any // Cast to any to handle flexible EditorNode structure
	} as TipTapEditorContent;
}

/**
 * Apply correction to a single segment
 */
function applyCorrectionToSegment(
	segment: SegmentWithTiming,
	alignment: SegmentAlignment
): CorrectedWord[] {
	const originalWords = segment.words.map(w => w.text);
	const correctedWords = tokenizeCorrectedText(alignment.correctedText);

	console.log(
		`[ApplyAlignedCorrections] Segment ${segment.index}: ${originalWords.length} -> ${correctedWords.length} words`
	);

	// Align original words to corrected words
	const wordAlignments = alignWords(originalWords, correctedWords);

	// Build corrected words with metadata from original words
	const result: CorrectedWord[] = [];
	let correctedIndex = 0;

	for (const wordAlign of wordAlignments) {
		if (wordAlign.operation === 'delete') {
			// Word was deleted - skip it
			continue;
		}

		if (wordAlign.operation === 'insert') {
			// Word was inserted - create new word with estimated timing
			const estimatedTiming = estimateWordTiming(
				segment.words,
				correctedIndex,
				result
			);

			result.push({
				text: wordAlign.correctedWord || '',
				start: estimatedTiming.start,
				end: estimatedTiming.end,
				speakerTag: segment.speakerTag,
				originalIndex: -1,
				correctedIndex: wordAlign.correctedIndex,
				operation: 'insert'
			});

			correctedIndex++;
		} else if (wordAlign.operation === 'match' || wordAlign.operation === 'substitute') {
			// Word matched or substituted - use original timing
			const originalWord = segment.words[wordAlign.originalIndex];

			if (originalWord) {
				result.push({
					text: wordAlign.correctedWord || wordAlign.originalWord || '',
					start: originalWord.start,
					end: originalWord.end,
					speakerTag: originalWord.speakerTag,
					originalIndex: wordAlign.originalIndex,
					correctedIndex: wordAlign.correctedIndex,
					operation: wordAlign.operation
				});
			}

			correctedIndex++;
		}
	}

	return result;
}

/**
 * Estimate timing for an inserted word
 */
function estimateWordTiming(
	originalWords: ExtractedWord[],
	insertPosition: number,
	previousCorrectedWords: CorrectedWord[]
): { start: number; end: number } {
	// Try to use timing from surrounding words
	if (previousCorrectedWords.length > 0) {
		const prevWord = previousCorrectedWords[previousCorrectedWords.length - 1];

		// Look ahead to find next word with timing
		let nextWordStart = prevWord.end + 0.1;

		// Use average word duration (0.3 seconds is typical)
		const wordDuration = 0.3;

		return {
			start: prevWord.end,
			end: prevWord.end + wordDuration
		};
	}

	// Fallback: use first original word's timing
	if (originalWords.length > 0) {
		const firstWord = originalWords[0];
		return {
			start: firstWord.start,
			end: firstWord.start + 0.3
		};
	}

	// Last resort: start at 0
	return {
		start: 0,
		end: 0.3
	};
}

/**
 * Create a speaker node with corrected words
 */
function createSpeakerNode(
	segment: SegmentWithTiming,
	words: CorrectedWord[] | ExtractedWord[]
): EditorNode {
	// Build paragraph content from words
	const paragraphContent: EditorNode[] = [];

	for (let i = 0; i < words.length; i++) {
		const word = words[i];

		// Create word node (using wordNode type for compatibility)
		paragraphContent.push({
			type: 'wordNode',
			attrs: {
				text: word.text,
				start: word.start,
				end: word.end
			}
		});

		// Add space after word (except for last word and before punctuation)
		if (i < words.length - 1) {
			const nextWord = words[i + 1];
			const needsSpace = !startsWithPunctuation(nextWord.text);

			if (needsSpace) {
				paragraphContent.push({
					type: 'text',
					text: ' '
				});
			}
		}
	}

	// Create speaker node
	return {
		type: 'speaker',
		attrs: {
			'data-name': segment.speakerTag,
			alternatives: segment.alternatives
		},
		content: [
			{
				type: 'paragraph',
				content: paragraphContent
			}
		]
	};
}

/**
 * Check if text starts with punctuation that shouldn't have space before
 */
function startsWithPunctuation(text: string): boolean {
	return /^[.,;:!?)\]}"'»]/.test(text);
}

/**
 * Apply corrections from correction agent results
 *
 * @param originalContent - Original TipTap editor content
 * @param correctionBlocks - Correction results from agent
 * @returns New TipTap editor content with all corrections applied
 */
export function applyAllCorrections(
	originalContent: TipTapEditorContent,
	correctionBlocks: Array<{
		blockIndex: number;
		alignments: SegmentAlignment[];
		status: string;
	}>
): TipTapEditorContent {
	console.log(`[ApplyAlignedCorrections] Applying corrections from ${correctionBlocks.length} blocks`);

	// Collect all segment alignments
	const allAlignments: SegmentAlignment[] = [];

	for (const block of correctionBlocks) {
		if (block.status === 'completed' && block.alignments) {
			allAlignments.push(...block.alignments);
		}
	}

	console.log(`[ApplyAlignedCorrections] Total ${allAlignments.length} segment alignments to apply`);

	// Apply all alignments
	return applySegmentAlignments(originalContent, allAlignments);
}

/**
 * Extract plain text from corrected content for export
 */
export function extractCorrectedPlainText(content: TipTapEditorContent): string {
	const paragraphs: string[] = [];

	if (!content || !content.content) {
		return '';
	}

	for (const speakerNode of content.content) {
		if (speakerNode.type !== 'speaker') {
			continue;
		}

		const speakerName = speakerNode.attrs?.['data-name'] || 'Unknown Speaker';
		const words: string[] = [];

		// Extract words from speaker node
		function extractWords(node: EditorNode) {
			if (node.type === 'wordNode' && node.attrs?.text) {
				words.push(node.attrs.text);
			}

			if (node.type === 'text' && node.text) {
				// Handle plain text nodes (spaces, punctuation)
				const trimmed = node.text.trim();
				if (trimmed) {
					words.push(trimmed);
				}
			}

			if (node.content) {
				for (const child of node.content) {
					extractWords(child);
				}
			}
		}

		extractWords(speakerNode);

		if (words.length > 0) {
			// Reconstruct text with proper spacing
			let text = '';
			for (let i = 0; i < words.length; i++) {
				const word = words[i];

				if (i === 0) {
					text = word;
				} else if (startsWithPunctuation(word)) {
					text += word;
				} else {
					text += ' ' + word;
				}
			}

			paragraphs.push(`${speakerName}: ${text}`);
		}
	}

	return paragraphs.join('\n\n');
}

/**
 * Count corrections applied to content
 */
export interface CorrectionStats {
	totalWords: number;
	matchedWords: number;
	substitutedWords: number;
	insertedWords: number;
	deletedWords: number;
	correctionRate: string;
}

/**
 * Calculate statistics about applied corrections
 */
export function calculateCorrectionStats(
	originalContent: TipTapEditorContent,
	segmentAlignments: SegmentAlignment[]
): CorrectionStats {
	const originalSegments = extractSpeakerSegments(originalContent);
	const alignmentMap = new Map<number, SegmentAlignment>();

	for (const alignment of segmentAlignments) {
		alignmentMap.set(alignment.segmentIndex, alignment);
	}

	let totalWords = 0;
	let matchedWords = 0;
	let substitutedWords = 0;
	let insertedWords = 0;
	let deletedWords = 0;

	for (const segment of originalSegments) {
		const alignment = alignmentMap.get(segment.index);

		if (!alignment || !alignment.correctedText) {
			// No correction - all words matched
			totalWords += segment.words.length;
			matchedWords += segment.words.length;
			continue;
		}

		const originalWords = segment.words.map(w => w.text);
		const correctedWords = tokenizeCorrectedText(alignment.correctedText);

		const wordAlignments = alignWords(originalWords, correctedWords);

		for (const wordAlign of wordAlignments) {
			if (wordAlign.operation === 'match') {
				matchedWords++;
				totalWords++;
			} else if (wordAlign.operation === 'substitute') {
				substitutedWords++;
				totalWords++;
			} else if (wordAlign.operation === 'insert') {
				insertedWords++;
			} else if (wordAlign.operation === 'delete') {
				deletedWords++;
				totalWords++;
			}
		}
	}

	const totalChanges = substitutedWords + insertedWords + deletedWords;
	const correctionRate =
		totalWords > 0 ? ((totalChanges / totalWords) * 100).toFixed(2) + '%' : '0%';

	return {
		totalWords,
		matchedWords,
		substitutedWords,
		insertedWords,
		deletedWords,
		correctionRate
	};
}
