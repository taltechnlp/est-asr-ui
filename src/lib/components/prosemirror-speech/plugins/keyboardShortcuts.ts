/**
 * Keyboard Shortcuts Plugin
 *
 * Handles keyboard navigation and approval shortcuts
 */

import { keymap } from 'prosemirror-keymap';
import { undo, redo } from 'prosemirror-history';
import type { Command } from 'prosemirror-state';
import {
	wordApprovalKey,
	approveWordCommand,
	approveSentenceCommand,
	approveParagraphCommand
} from './wordApproval';

/**
 * Find the next word position after the current position
 */
function findNextWordPos(state: any, currentPos: number | null): number | null {
	let nextPos: number | null = null;
	const startPos = currentPos !== null ? currentPos + 1 : 0;

	state.doc.descendants((node: any, pos: number) => {
		if (nextPos !== null) return false; // Already found

		if (pos >= startPos && node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark: any) => mark.type.name === 'word');
			if (wordMark && !wordMark.attrs.approved) {
				nextPos = pos;
				return false; // Stop traversal
			}
		}
	});

	return nextPos;
}

/**
 * Find the previous word position before the current position
 */
function findPrevWordPos(state: any, currentPos: number | null): number | null {
	const words: number[] = [];

	state.doc.descendants((node: any, pos: number) => {
		if (node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark: any) => mark.type.name === 'word');
			if (wordMark && !wordMark.attrs.approved) {
				words.push(pos);
			}
		}
	});

	if (currentPos === null) {
		return words.length > 0 ? words[0] : null;
	}

	// Find last word before current position
	for (let i = words.length - 1; i >= 0; i--) {
		if (words[i] < currentPos) {
			return words[i];
		}
	}

	return null;
}

/**
 * Navigate to next word
 */
const nextWordCommand: Command = (state, dispatch) => {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState) return false;

	const nextPos = findNextWordPos(state, pluginState.activeWordPos);
	if (nextPos === null) return false;

	if (dispatch) {
		const tr = state.tr;
		tr.setMeta('setActiveWord', nextPos);
		// Set selection to the word position
		tr.setSelection(state.selection.constructor.near(state.doc.resolve(nextPos)));
		dispatch(tr);
	}

	return true;
};

/**
 * Navigate to previous word
 */
const prevWordCommand: Command = (state, dispatch) => {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState) return false;

	const prevPos = findPrevWordPos(state, pluginState.activeWordPos);
	if (prevPos === null) return false;

	if (dispatch) {
		const tr = state.tr;
		tr.setMeta('setActiveWord', prevPos);
		// Set selection to the word position
		tr.setSelection(state.selection.constructor.near(state.doc.resolve(prevPos)));
		dispatch(tr);
	}

	return true;
};

/**
 * Toggle approval mode
 */
const toggleApprovalModeCommand: Command = (state, dispatch) => {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState) return false;

	if (dispatch) {
		const modes: Array<'word' | 'sentence' | 'paragraph'> = ['word', 'sentence', 'paragraph'];
		const currentIndex = modes.indexOf(pluginState.approvalMode);
		const nextMode = modes[(currentIndex + 1) % modes.length];

		const tr = state.tr;
		tr.setMeta('setApprovalMode', nextMode);
		dispatch(tr);

		console.log(`Approval mode: ${nextMode}`);
	}

	return true;
};

/**
 * Approve based on current mode
 */
const approveCommand: Command = (state, dispatch) => {
	const pluginState = wordApprovalKey.getState(state);
	if (!pluginState) return false;

	switch (pluginState.approvalMode) {
		case 'word':
			return approveWordCommand(state, dispatch);
		case 'sentence':
			return approveSentenceCommand(state, dispatch);
		case 'paragraph':
			return approveParagraphCommand(state, dispatch);
		default:
			return false;
	}
};

/**
 * Create keyboard shortcuts plugin
 */
export function keyboardShortcutsPlugin() {
	return keymap({
		// Navigation
		Tab: nextWordCommand,
		'Shift-Tab': prevWordCommand,
		ArrowRight: nextWordCommand,
		ArrowLeft: prevWordCommand,

		// Approval
		Enter: approveCommand,
		Space: approveCommand,
		'Shift-Enter': approveSentenceCommand,
		'Ctrl-Enter': approveParagraphCommand,

		// Undo/Redo
		'Mod-z': undo,
		'Mod-y': redo,
		'Mod-Shift-z': redo,

		// Mode toggle
		'Ctrl-e': toggleApprovalModeCommand,

		// Escape: would cancel edit / revert word (implement in future)
		Escape: (state, dispatch) => {
			// TODO: Implement revert to original ASR word
			console.log('Escape: Revert not yet implemented');
			return true;
		}
	});
}
