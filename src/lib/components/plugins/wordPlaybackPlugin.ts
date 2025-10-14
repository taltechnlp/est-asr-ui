import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { waveform } from '$lib/stores.svelte';
import {
	wordTimingPluginKey,
	findWordIndexForTime,
	getTimingForIndex,
	getPositionForIndex,
	type TimingPluginState
} from './wordTimingPlugin';

let ws;
waveform.subscribe((w) => {
	ws = w;
});

interface PlaybackState {
	currentWordIndex: number;
	decorationSet: DecorationSet;
}

export const wordPlaybackPluginKey = new PluginKey<PlaybackState>('wordPlayback');

/**
 * Plugin for handling audio playback highlighting and click-to-seek.
 * Uses the separate timing data from wordTimingPlugin instead of node attributes.
 */
export const WordPlaybackPlugin = Extension.create({
	name: 'wordPlayback',

	priority: 100,  // Lower priority to ensure this loads after WordTimingPlugin

	addProseMirrorPlugins() {
		const plugin = new Plugin<PlaybackState>({
			key: wordPlaybackPluginKey,

			state: {
				init(config, editorState) {
					return {
						currentWordIndex: -1,
						decorationSet: DecorationSet.empty
					};
				},

				apply(tr, state, oldState, newState) {
					// Check for playback position update
					const playbackMeta = tr.getMeta('playback');

					if (playbackMeta && playbackMeta.time !== undefined) {
						// Get timing plugin state using the imported plugin key
						const timingState = wordTimingPluginKey.getState(newState);

						if (!timingState) {
							return state;
						}

						const wordIndex = findWordIndexForTime(timingState.timingArray, playbackMeta.time);

						if (wordIndex === -1) {
							return state;
						}

						if (wordIndex === state.currentWordIndex) {
							return state;
						}

						const pos = getPositionForIndex(timingState, wordIndex);

						if (pos === null) {
							return state;
						}

						// Find the word node at this position
						const node = tr.doc.nodeAt(pos);
						if (!node || node.type.name !== 'wordNode') return state;

						const endPos = pos + node.nodeSize;

						// Create decorations: gray text before current word, blue for current word
						const decorations = [
							Decoration.inline(0, Math.max(0, pos - 1), {
								style: 'color: #9b9b9b'
							}),
							Decoration.inline(pos, endPos, {
								style: 'color: #70acc7; font-weight: 500;'
							})
						];

						return {
							currentWordIndex: wordIndex,
							decorationSet: DecorationSet.create(tr.doc, decorations)
						};
					}

					// If document changed, update decorations
					if (tr.docChanged && state.currentWordIndex !== -1) {
						return {
							currentWordIndex: state.currentWordIndex,
							decorationSet: state.decorationSet.map(tr.mapping, tr.doc)
						};
					}

					return state;
				}
			},

			props: {
				decorations(state) {
					return plugin.getState(state)?.decorationSet || DecorationSet.empty;
				},

				handleClick(view, pos, event) {
					// Get timing plugin state using the imported plugin key
					const timingState = wordTimingPluginKey.getState(view.state);

					if (!timingState) return false;

					// Check if we clicked on a word node
					const $pos = view.state.doc.resolve(pos);
					const node = view.state.doc.nodeAt(pos);

					// Try to find word node (either at position or as parent)
					let wordNode = null;
					let wordIndex = null;

					if (node && node.type.name === 'wordNode') {
						wordNode = node;
						wordIndex = node.attrs.wordIndex;
					} else {
						// Check if parent is a word node
						const parent = $pos.parent;
						if (parent && parent.type.name === 'wordNode') {
							wordNode = parent;
							wordIndex = parent.attrs.wordIndex;
						}
					}

					// If we found a word node with timing data, seek to it
					if (wordNode && wordIndex !== null && wordIndex !== undefined) {
						const timing = getTimingForIndex(timingState, wordIndex);
						if (timing && ws && ws.player) {
							ws.player.seek(timing.start);
							return true; // We handled the click
						}
					}

					return false; // Let other handlers process the click
				}
			}
		});

		return [plugin];
	}
});

/**
 * Helper function to trigger playback position update
 * Call this from your audio player's timeupdate handler
 */
export function updatePlaybackPosition(editor: any, time: number) {
	if (!editor || !editor.state) {
		return;
	}

	editor.view.dispatch(
		editor.state.tr.setMeta('playback', {
			time
		})
	);
}
