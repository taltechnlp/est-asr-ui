/**
 * Subtitle Segmentation Plugin
 *
 * Monitors text and creates paragraph breaks based on subtitle rules
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import { shouldBreakAtWord } from '../utils/subtitleRules';
import type { Word, SubtitleSegment } from '../utils/types';
import { wordsToSegment } from '../utils/srtExport';

export interface SubtitleSegmentationState {
	segments: SubtitleSegment[];
	currentSegmentLength: number;
	lastCheckPosition: number;
	recordingEnded: boolean;
	lastEmittedWordCount: number;
}

export const subtitleSegmentationKey = new PluginKey<SubtitleSegmentationState>(
	'subtitleSegmentation'
);

/**
 * Extract words from a paragraph node
 */
function extractWordsFromParagraph(para: Node, startPos: number): Word[] {
	const words: Word[] = [];

	para.descendants((node, pos) => {
		if (node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark) => mark.type.name === 'word');
			if (wordMark) {
				words.push({
					id: wordMark.attrs.id,
					text: node.text || '',
					start: wordMark.attrs.start,
					end: wordMark.attrs.end,
					approved: wordMark.attrs.approved
				});
			}
		}
	});

	return words;
}

/**
 * Calculate text length of current segment
 */
function calculateSegmentLength(doc: Node, paraIndex: number): number {
	let length = 0;
	const para = doc.child(paraIndex);

	para.descendants((node) => {
		if (node.isText) {
			length += (node.text || '').length;
		}
	});

	return length;
}

/**
 * Check if we should split the paragraph
 */
function shouldSplitParagraph(
	doc: Node,
	paraIndex: number
): { shouldSplit: boolean; splitPos?: number } {
	const para = doc.child(paraIndex);
	const words = extractWordsFromParagraph(para, 0);

	if (words.length === 0) {
		return { shouldSplit: false };
	}

	// Check each word to see if we should break
	// Calculate accumulated length up to each word
	let accumulatedLength = 0;
	for (let i = 0; i < words.length; i++) {
		accumulatedLength += words[i].text.length;

		if (shouldBreakAtWord(words, i, accumulatedLength)) {
			// Find the position after this word
			let currentPos = 0;
			let splitPos: number | undefined;

			para.descendants((node, pos) => {
				if (splitPos !== undefined) return false;

				if (node.isText) {
					const wordMark = node.marks.find((mark) => mark.type.name === 'word');
					if (wordMark && wordMark.attrs.id === words[i].id) {
						splitPos = pos + node.nodeSize;
						return false;
					}
				}
			});

			if (splitPos !== undefined) {
				return { shouldSplit: true, splitPos };
			}
		}
	}

	return { shouldSplit: false };
}

/**
 * Split paragraph at position
 */
function splitParagraphAt(tr: Transaction, paraPos: number, splitPos: number): Transaction {
	const $pos = tr.doc.resolve(paraPos + splitPos);

	// Create a new paragraph
	const newPara = tr.doc.type.schema.nodes.paragraph.create();

	// Split the paragraph
	tr.split($pos.pos);

	return tr;
}

/**
 * Create subtitle segmentation plugin
 */
export function subtitleSegmentationPlugin(onSegmentComplete?: (segment: SubtitleSegment) => void) {
	return new Plugin<SubtitleSegmentationState>({
		key: subtitleSegmentationKey,

		state: {
			init(): SubtitleSegmentationState {
				return {
					segments: [],
					currentSegmentLength: 0,
					lastCheckPosition: 0,
					recordingEnded: false,
					lastEmittedWordCount: 0
				};
			},

			apply(tr, value, oldState, newState): SubtitleSegmentationState {
				let { segments, currentSegmentLength, lastCheckPosition, recordingEnded, lastEmittedWordCount } = value;

				// Track if recording ended
				if (tr.getMeta('recordingEnded')) {
					recordingEnded = true;
					console.log('[SUBTITLE-SEGMENTATION] Recording ended flag set');
				}

				// Update segment list on document changes
				if (tr.docChanged) {
					// Recalculate current segment length
					const lastParaIndex = newState.doc.childCount - 1;
					currentSegmentLength = calculateSegmentLength(newState.doc, lastParaIndex);

					// Check if we need to update segments
					const segmentCompleteMeta = tr.getMeta('segmentComplete');
					if (segmentCompleteMeta && onSegmentComplete) {
						onSegmentComplete(segmentCompleteMeta);
						segments = [...segments, segmentCompleteMeta];

						// Count how many words were in this segment
						lastEmittedWordCount += segmentCompleteMeta.words.length;
					}
				}

				return {
					segments,
					currentSegmentLength,
					lastCheckPosition,
					recordingEnded,
					lastEmittedWordCount
				};
			}
		},

		// Monitor for automatic paragraph breaks
		appendTransaction(transactions, oldState, newState) {
			const tr = newState.tr;
			let modified = false;

			// Check if all words were just approved - emit final segment
			const allWordsApproved = transactions.some((t) => t.getMeta('allWordsApproved'));
			if (allWordsApproved) {
				const pluginState = subtitleSegmentationKey.getState(newState);
				const lastParaIndex = newState.doc.childCount - 1;

				if (pluginState && lastParaIndex >= 0) {
					// Get all approved words from the last paragraph
					const lastPara = newState.doc.child(lastParaIndex);
					const allWords = extractWordsFromParagraph(lastPara, 0);
					const approvedWords = allWords.filter((w) => w.approved);

					console.log('[SUBTITLE-SEGMENTATION] All words approved signal received, creating final segment with', approvedWords.length, 'words');

					if (approvedWords.length > 0) {
						const segmentIndex = pluginState.segments.length + 1;
						const segment = wordsToSegment(approvedWords, segmentIndex);
						tr.setMeta('segmentComplete', segment);
						modified = true;
					}
				}

				return modified ? tr : null;
			}

			// Check if we should split the last paragraph
			const lastParaIndex = newState.doc.childCount - 1;
			if (lastParaIndex >= 0) {
				const result = shouldSplitParagraph(newState.doc, lastParaIndex);

				if (result.shouldSplit && result.splitPos !== undefined) {
					// Calculate paragraph position
					let paraPos = 0;
					for (let i = 0; i < lastParaIndex; i++) {
						paraPos += newState.doc.child(i).nodeSize;
					}

					// Extract words from completed segment
					const para = newState.doc.child(lastParaIndex);
					const words = extractWordsFromParagraph(para, paraPos);

					// Split the words at the split position
					let splitWordIndex = 0;
					let charCount = 0;
					for (let i = 0; i < words.length; i++) {
						charCount += words[i].text.length;
						if (charCount >= result.splitPos) {
							splitWordIndex = i + 1;
							break;
						}
					}

					const completedWords = words.slice(0, splitWordIndex);

					// ONLY split if we have approved words in the segment
					// This prevents infinite splitting during streaming (pending) text
					const hasApprovedWords = completedWords.some((w) => w.approved);

					if (hasApprovedWords) {
						// Create subtitle segment
						if (completedWords.length > 0 && completedWords[0].approved) {
							const pluginState = subtitleSegmentationKey.getState(newState);
							const segmentIndex = pluginState ? pluginState.segments.length + 1 : 1;

							const segment = wordsToSegment(completedWords, segmentIndex);
							tr.setMeta('segmentComplete', segment);
						}

						// Perform the split
						splitParagraphAt(tr, paraPos + 1, result.splitPos);
						modified = true;
					}
				}
			}

			// After normal splitting, check if recording ended and we have unemitted approved words
			const pluginState = subtitleSegmentationKey.getState(newState);
			if (pluginState && pluginState.recordingEnded && lastParaIndex >= 0) {
				// Count total approved words across ALL paragraphs
				let totalApprovedWords = 0;
				newState.doc.descendants((node) => {
					if (node.isText && node.marks.length > 0) {
						const wordMark = node.marks.find((mark) => mark.type.name === 'word');
						if (wordMark && wordMark.attrs.approved && node.text && node.text.trim().length > 0) {
							totalApprovedWords++;
						}
					}
				});

				// If we have approved words that haven't been emitted yet, emit them
				const unemittedWordCount = totalApprovedWords - pluginState.lastEmittedWordCount;

				console.log('[SUBTITLE-SEGMENTATION] Recording ended check:', {
					totalApproved: totalApprovedWords,
					lastEmitted: pluginState.lastEmittedWordCount,
					unemitted: unemittedWordCount
				});

				if (unemittedWordCount > 0) {
					// Get all approved words from the last paragraph (these are the unemitted ones)
					const lastPara = newState.doc.child(lastParaIndex);
					const allWords = extractWordsFromParagraph(lastPara, 0);
					const approvedWords = allWords.filter((w) => w.approved);

					if (approvedWords.length > 0) {
						const segmentIndex = pluginState.segments.length + 1;
						const segment = wordsToSegment(approvedWords, segmentIndex);
						console.log('[SUBTITLE-SEGMENTATION] Creating final segment with', approvedWords.length, 'words');
						tr.setMeta('segmentComplete', segment);
						modified = true;
					}
				}
			}

			return modified ? tr : null;
		},

		view(editorView) {
			return {
				update(view, prevState) {
					const pluginState = subtitleSegmentationKey.getState(view.state);
					if (!pluginState || !pluginState.recordingEnded) return;

					// Check if all words are approved
					let totalWords = 0;
					let approvedWords = 0;
					view.state.doc.descendants((node) => {
						if (node.isText && node.marks.length > 0) {
							const wordMark = node.marks.find((mark) => mark.type.name === 'word');
							if (wordMark && node.text && node.text.trim().length > 0) {
								totalWords++;
								if (wordMark.attrs.approved) {
									approvedWords++;
								}
							}
						}
					});

					// If we have approved words that haven't been emitted yet, emit final segment
					// Don't require ALL words to be approved - just emit what we have
					if (totalWords > 0 && approvedWords > 0 && pluginState.lastEmittedWordCount < approvedWords) {
						console.log('[SUBTITLE-SEGMENTATION] View update:', approvedWords, 'words approved, emitting final segment');

						const lastParaIndex = view.state.doc.childCount - 1;
						if (lastParaIndex >= 0) {
							const lastPara = view.state.doc.child(lastParaIndex);
							const allWords = extractWordsFromParagraph(lastPara, 0);
							const approvedWordsOnly = allWords.filter((w) => w.approved);

							if (approvedWordsOnly.length > 0) {
								const tr = view.state.tr;
								const segmentIndex = pluginState.segments.length + 1;
								const segment = wordsToSegment(approvedWordsOnly, segmentIndex);
								tr.setMeta('segmentComplete', segment);
								view.dispatch(tr);
							}
						}
					}
				}
			};
		}
	});
}
