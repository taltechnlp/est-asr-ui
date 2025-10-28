/**
 * Word Approval Plugin
 *
 * Manages word approval state and makes approved words read-only
 */

import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import type { Node } from 'prosemirror-model';
import type { Word, ApprovalMode } from '../utils/types';

export interface WordApprovalState {
	approvalBoundary: number; // Document position before which everything is read-only
	activeWordPos: number | null; // Position of the active word
	approvalMode: ApprovalMode;
	decorations: DecorationSet;
}

export const wordApprovalKey = new PluginKey<WordApprovalState>('wordApproval');

/**
 * Find all words in the document with their positions
 */
function findWords(doc: Node): Array<{ from: number; to: number; mark: any }> {
	const words: Array<{ from: number; to: number; mark: any }> = [];

	doc.descendants((node, pos) => {
		if (node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark) => mark.type.name === 'word');
			if (wordMark) {
				words.push({
					from: pos,
					to: pos + node.nodeSize,
					mark: wordMark
				});
			}
		}
	});

	return words;
}

/**
 * Find the next unapproved word after the given position
 */
function findNextUnapprovedWord(
	doc: Node,
	fromPos: number
): { from: number; to: number; mark: any } | null {
	let result: { from: number; to: number; mark: any } | null = null;

	doc.descendants((node, pos) => {
		if (result) return false; // Already found

		if (pos >= fromPos && node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark) => mark.type.name === 'word');
			if (wordMark && !wordMark.attrs.approved) {
				result = { from: pos, to: pos + node.nodeSize, mark: wordMark };
				return false; // Stop traversal
			}
		}
	});

	return result;
}

/**
 * Create decorations for active word highlighting
 */
function createDecorations(doc: Node, activeWordPos: number | null): DecorationSet {
	const decorations: Decoration[] = [];

	if (activeWordPos !== null) {
		// Find the word at active position
		doc.descendants((node, pos) => {
			if (pos === activeWordPos && node.isText) {
				decorations.push(
					Decoration.inline(pos, pos + node.nodeSize, {
						class: 'word-state-active'
					})
				);
			}
		});
	}

	return DecorationSet.create(doc, decorations);
}

/**
 * Approve word at given position
 */
export function approveWord(tr: Transaction, wordPos: number): Transaction {
	const node = tr.doc.nodeAt(wordPos);
	if (!node || !node.isText) return tr;

	const wordMark = node.marks.find((mark) => mark.type.name === 'word');
	if (!wordMark) return tr;

	// Update word mark to set approved = true
	const newMark = wordMark.type.create({
		...wordMark.attrs,
		approved: true
	});

	// Remove old marks and add new one
	tr.removeMark(wordPos, wordPos + node.nodeSize, wordMark.type);
	tr.addMark(wordPos, wordPos + node.nodeSize, newMark);

	// Remove pending mark if exists
	const pendingMark = tr.doc.type.schema.marks.pending;
	if (pendingMark) {
		tr.removeMark(wordPos, wordPos + node.nodeSize, pendingMark);
	}

	return tr;
}

/**
 * Approve all words from start position to end position
 */
export function approveWordsInRange(tr: Transaction, from: number, to: number): Transaction {
	tr.doc.nodesBetween(from, to, (node, pos) => {
		if (node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark) => mark.type.name === 'word');
			if (wordMark && !wordMark.attrs.approved) {
				const wordFrom = pos;
				const wordTo = pos + node.nodeSize;

				// Update word mark to set approved = true
				const newMark = wordMark.type.create({
					...wordMark.attrs,
					approved: true
				});

				tr.removeMark(wordFrom, wordTo, wordMark.type);
				tr.addMark(wordFrom, wordTo, newMark);

				// Remove pending mark if exists
				const pendingMark = tr.doc.type.schema.marks.pending;
				if (pendingMark) {
					tr.removeMark(wordFrom, wordTo, pendingMark);
				}
			}
		}
	});

	return tr;
}

/**
 * Find end of sentence from given position
 */
function findSentenceEnd(doc: Node, fromPos: number): number {
	let endPos = fromPos;

	doc.nodesBetween(fromPos, doc.content.size, (node, pos) => {
		if (node.isText) {
			const text = node.text || '';
			const match = text.match(/[.!?]/);
			if (match && match.index !== undefined) {
				endPos = pos + match.index + 1;
				return false; // Stop traversal
			}
			endPos = pos + node.nodeSize;
		}
	});

	return endPos;
}

/**
 * Word Approval Plugin
 */
export function wordApprovalPlugin(
	onWordApproved?: (word: Word) => void,
	initialMode: ApprovalMode = 'word'
) {
	return new Plugin<WordApprovalState>({
		key: wordApprovalKey,

		state: {
			init(config, state): WordApprovalState {
				return {
					approvalBoundary: 0,
					activeWordPos: null,
					approvalMode: initialMode,
					decorations: DecorationSet.empty
				};
			},

			apply(tr, value, oldState, newState): WordApprovalState {
				let { approvalBoundary, activeWordPos, approvalMode, decorations } = value;

				// Handle meta actions
				const setActiveWord = tr.getMeta('setActiveWord');
				if (setActiveWord !== undefined) {
					activeWordPos = setActiveWord;
				}

				const setApprovalMode = tr.getMeta('setApprovalMode');
				if (setApprovalMode !== undefined) {
					approvalMode = setApprovalMode;
				}

				const approveWordMeta = tr.getMeta('approveWord');
				if (approveWordMeta !== undefined) {
					// Word was approved, update boundary
					approvalBoundary = Math.max(approvalBoundary, approveWordMeta);

					// Notify callback
					if (onWordApproved) {
						const node = newState.doc.nodeAt(approveWordMeta);
						if (node && node.isText) {
							const wordMark = node.marks.find((mark) => mark.type.name === 'word');
							if (wordMark) {
								onWordApproved({
									id: wordMark.attrs.id,
									text: node.text || '',
									start: wordMark.attrs.start,
									end: wordMark.attrs.end,
									approved: true
								});
							}
						}
					}

					// Move active word to next unapproved word
					const nextWord = findNextUnapprovedWord(newState.doc, approveWordMeta);
					activeWordPos = nextWord ? nextWord.from : null;
				}

				// Update decorations
				if (tr.docChanged || setActiveWord !== undefined || approveWordMeta !== undefined) {
					decorations = createDecorations(newState.doc, activeWordPos);
				}

				return {
					approvalBoundary,
					activeWordPos,
					approvalMode,
					decorations
				};
			}
		},

		props: {
			decorations(state) {
				return wordApprovalKey.getState(state)?.decorations;
			},

			// Make approved text read-only
			editable(state) {
				return true; // Let handleTextInput handle the filtering
			}
		},

		// Prevent editing of approved words
		filterTransaction(tr, state) {
			const pluginState = wordApprovalKey.getState(state);
			if (!pluginState) return true;

			// Allow meta transactions
			if (tr.getMeta('addToHistory') === false) return true;

			// Check if trying to edit before approval boundary
			if (tr.docChanged) {
				const { approvalBoundary } = pluginState;

				// Check each step to see if it modifies approved content
				for (let i = 0; i < tr.steps.length; i++) {
					const step = tr.steps[i];
					// @ts-ignore - accessing private property
					if (step.from !== undefined && step.from < approvalBoundary) {
						return false;
					}
				}
			}

			return true;
		}
	});
}

/**
 * Helper: Approve word command
 */
export function approveWordCommand(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState || pluginState.activeWordPos === null) return false;

	if (dispatch) {
		let tr = state.tr;
		tr = approveWord(tr, pluginState.activeWordPos);
		tr.setMeta('approveWord', pluginState.activeWordPos);
		dispatch(tr);
	}

	return true;
}

/**
 * Helper: Approve word at specific position (for programmatic approval)
 */
export function approveWordAtPosition(
	state: EditorState,
	dispatch: (tr: Transaction) => void,
	wordPos: number
): boolean {
	const node = state.doc.nodeAt(wordPos);
	if (!node || !node.isText) {
		return false;
	}

	const wordMark = node.marks.find((mark) => mark.type.name === 'word');
	if (!wordMark) {
		return false;
	}

	if (wordMark.attrs.approved) {
		return false;
	}

	let tr = state.tr;
	tr = approveWord(tr, wordPos);
	tr.setMeta('approveWord', wordPos);
	dispatch(tr);

	return true;
}

/**
 * Helper: Approve sentence command
 */
export function approveSentenceCommand(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState || pluginState.activeWordPos === null) return false;

	if (dispatch) {
		const sentenceEnd = findSentenceEnd(state.doc, pluginState.activeWordPos);
		let tr = state.tr;
		tr = approveWordsInRange(tr, pluginState.activeWordPos, sentenceEnd);
		tr.setMeta('approveWord', sentenceEnd);
		dispatch(tr);
	}

	return true;
}

/**
 * Helper: Approve paragraph command
 */
export function approveParagraphCommand(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState || pluginState.activeWordPos === null) return false;

	if (dispatch) {
		// Find current paragraph
		const $pos = state.doc.resolve(pluginState.activeWordPos);
		const paragraphStart = $pos.before($pos.depth);
		const paragraphEnd = $pos.after($pos.depth);

		let tr = state.tr;
		tr = approveWordsInRange(tr, paragraphStart, paragraphEnd);
		tr.setMeta('approveWord', paragraphEnd);
		dispatch(tr);
	}

	return true;
}
