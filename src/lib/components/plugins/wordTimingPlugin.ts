import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

/**
 * Timing data for a single word
 */
export interface WordTiming {
	start: number;
	end: number;
}

/**
 * Plugin state structure
 */
export interface TimingPluginState {
	// Immutable array of timing data (source of truth)
	timingArray: WordTiming[];
	// Map from word index to current document position
	wordPositionMap: Map<number, number>;
}

export const wordTimingPluginKey = new PluginKey<TimingPluginState>('wordTiming');

/**
 * Binary search to find the word index for a given time
 * Returns the index of the word that contains the time, or -1 if not found
 */
export function findWordIndexForTime(timingArray: WordTiming[], time: number): number {
	let left = 0;
	let right = timingArray.length - 1;
	let result = -1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const timing = timingArray[mid];

		if (time >= timing.start && time <= timing.end) {
			return mid; // Found exact match
		} else if (time < timing.start) {
			right = mid - 1;
		} else {
			// time > timing.end
			result = mid; // Keep track of the last word we passed
			left = mid + 1;
		}
	}

	return result; // Return the last word before the time
}

/**
 * Helper to get timing for a specific word index
 */
export function getTimingForIndex(state: TimingPluginState, wordIndex: number): WordTiming | null {
	if (wordIndex >= 0 && wordIndex < state.timingArray.length) {
		return state.timingArray[wordIndex];
	}
	return null;
}

/**
 * Helper to get document position for a specific word index
 */
export function getPositionForIndex(state: TimingPluginState, wordIndex: number): number | null {
	return state.wordPositionMap.get(wordIndex) ?? null;
}

/**
 * Extension that accepts timing data and creates the plugin
 */
export interface WordTimingOptions {
	timingArray: WordTiming[];
}

export const WordTimingPlugin = Extension.create<WordTimingOptions>({
	name: 'wordTiming',

	addOptions() {
		return {
			timingArray: []
		};
	},

	addProseMirrorPlugins() {
		const timingArray = this.options.timingArray;

		const plugin = new Plugin<TimingPluginState>({
			key: wordTimingPluginKey,

			state: {
				init(config, editorState) {
					// Build initial word position map
					const wordPositionMap = new Map<number, number>();
					let wordIndex = 0;

					editorState.doc.descendants((node, pos) => {
						if (node.type.name === 'wordNode' && node.attrs.wordIndex !== undefined) {
							wordPositionMap.set(node.attrs.wordIndex, pos);
						}
						return true;
					});

					return {
						timingArray,
						wordPositionMap
					};
				},

				apply(tr, state, oldState, newState) {
					// If the document hasn't changed, return the same state
					if (!tr.docChanged) {
						return state;
					}

					// Rebuild the word position map after document changes
					const newWordPositionMap = new Map<number, number>();

					tr.doc.descendants((node, pos) => {
						if (node.type.name === 'wordNode' && node.attrs.wordIndex !== undefined) {
							newWordPositionMap.set(node.attrs.wordIndex, pos);
						}
						return true;
					});

					return {
						timingArray: state.timingArray, // Immutable
						wordPositionMap: newWordPositionMap
					};
				}
			}
		});

		return [plugin];
	}
});

/**
 * Helper function to get the plugin state from an editor instance
 */
export function getTimingPluginState(editor: any): TimingPluginState | null {
	if (!editor || !editor.state) return null;
	return wordTimingPluginKey.getState(editor.state) ?? null;
}

/**
 * Get document position for a given playback time
 */
export function getPositionForTime(editor: any, time: number): number | null {
	const state = getTimingPluginState(editor);
	if (!state) return null;

	const wordIndex = findWordIndexForTime(state.timingArray, time);
	if (wordIndex === -1) return null;

	return getPositionForIndex(state, wordIndex);
}

/**
 * Get timing data for a given document position
 */
export function getTimingForPosition(editor: any, pos: number): WordTiming | null {
	const state = getTimingPluginState(editor);
	if (!state) return null;

	// Find which word node contains this position
	const node = editor.state.doc.nodeAt(pos);
	if (!node || node.type.name !== 'wordNode') {
		// Try to find parent word node
		const $pos = editor.state.doc.resolve(pos);
		const parent = $pos.parent;
		if (parent.type.name === 'wordNode' && parent.attrs.wordIndex !== undefined) {
			return getTimingForIndex(state, parent.attrs.wordIndex);
		}
		return null;
	}

	if (node.attrs.wordIndex === undefined) return null;
	return getTimingForIndex(state, node.attrs.wordIndex);
}
