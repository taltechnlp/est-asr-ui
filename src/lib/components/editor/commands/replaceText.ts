import type { Command } from '@tiptap/core';
import type { Transaction } from 'prosemirror-state';
import { findTextPositions, type TextMatch } from '$lib/services/transcriptTextReplace';

export interface FindAndReplaceOptions {
	searchText: string;
	replaceText: string;
	caseSensitive?: boolean;
	wholeWord?: boolean;
	segmentId?: string;
}

/**
 * Command to find and replace text in the document
 */
export const findAndReplace =
	(options: FindAndReplaceOptions): Command =>
	({ editor, tr, dispatch }) => {
		const { searchText, replaceText, caseSensitive, wholeWord, segmentId } = options;

		if (!searchText) return false;

		const matches = findTextPositions(editor.state.doc, searchText, {
			caseSensitive,
			wholeWord,
			segmentId
		});

		if (matches.length === 0) return false;

		// If dispatch is false, we're just checking if the command can run
		if (!dispatch) return true;

		// Sort matches in reverse order to avoid position shifting issues
		const sortedMatches = [...matches].sort((a, b) => b.from - a.from);

		// Apply all replacements
		sortedMatches.forEach((match) => {
			// Get marks at the position to preserve them
			const $from = tr.doc.resolve(match.from);
			const marks = $from.marks();

			// Replace with the new text, preserving marks
			tr.replaceWith(match.from, match.to, editor.schema.text(replaceText, marks));
		});

		return true;
	};

/**
 * Command to replace text at a specific position
 */
export const replaceAtPosition =
	(options: { from: number; to: number; text: string; preserveMarks?: boolean }): Command =>
	({ tr, state, dispatch }) => {
		const { from, to, text, preserveMarks = true } = options;

		// Validate positions
		if (from < 0 || to > state.doc.content.size || from > to) {
			return false;
		}

		if (!dispatch) return true;

		if (preserveMarks) {
			// Get marks at the position
			const $from = state.doc.resolve(from);
			const marks = $from.marks();

			// Replace with marked text
			tr.replaceWith(from, to, state.schema.text(text, marks));
		} else {
			// Simple text replacement
			tr.replaceWith(from, to, state.schema.text(text));
		}

		return true;
	};

/**
 * Command to highlight a text match temporarily
 */
export const highlightMatch =
	(match: TextMatch): Command =>
	({ tr, state, dispatch }) => {
		if (!dispatch) return true;

		// Add a temporary decoration or mark to highlight the match
		// This would require setting up a decoration plugin
		// For now, we'll just set the selection to the match
		tr.setSelection(
			state.schema.selection.between(state.doc.resolve(match.from), state.doc.resolve(match.to))
		);

		return true;
	};

/**
 * Command to update speaker name
 */
export const updateSpeakerName =
	(options: { segmentId: string; newName: string }): Command =>
	({ tr, state, dispatch }) => {
		const { segmentId, newName } = options;

		let found = false;
		let nodePos = -1;
		let node = null;

		state.doc.descendants((n, pos) => {
			if (n.type.name === 'speaker' && n.attrs.id === segmentId) {
				found = true;
				nodePos = pos;
				node = n;
				return false;
			}
		});

		if (!found || !node) return false;
		if (!dispatch) return true;

		// Update the speaker node's data-name attribute
		tr.setNodeMarkup(nodePos, null, {
			...node.attrs,
			'data-name': newName
		});

		return true;
	};
