import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { waveform } from '$lib/stores.svelte';

let ws;
waveform.subscribe((w) => {
	ws = w;
});

export const WordColorAI = Extension.create({
	name: 'wordColorAI',
	addProseMirrorPlugins() {
		let wordColorAI = new Plugin({
			key: new PluginKey('wordColorAI'),
			state: {
				init(plugins, editorState) {
					let lastPos = 0;
					let posMap = [];
					let posOffset = 0;
					let limit = editorState.doc.nodeSize - 2;

					// Find all Word nodes and track their positions
					editorState.doc.nodesBetween(0, limit, (node, pos, parent) => {
						if (node.type.name === 'wordNode') {
							posMap.push({
								...node.attrs,
								startPos: pos,
								node,
								endPos: pos + node.nodeSize
							});
						}
					});
					return { set: DecorationSet.create(editorState.doc, []), lastPos, posMap };
				},
				apply(tr, state, oldState, newState) {
					if (tr.getMeta('wordColorAI')) {
						const { id, start, end, event } = tr.getMeta('wordColorAI');
						const node = state.posMap.find((x) => x.id === id);
						if (node && event == 'in') {
							return {
								set: DecorationSet.create(tr.doc, [
									Decoration.inline(0, node.startPos - 1, { style: 'color: #9b9b9b' }),
									Decoration.inline(node.startPos, node.endPos, { style: 'color: #70acc7' })
								]),
								lastPos: node.startPos,
								posMap: state.posMap
							};
						} else if (node && event == 'out') {
							return {
								set: DecorationSet.create(tr.doc, [
									Decoration.inline(0, node.endPos, { style: 'color: #9b9b9b' })
								]),
								lastPos: node.startPos,
								posMap: state.posMap
							};
						}
						return state;
					} else {
						// Update posMap after document changes
						let newPosMap = [];
						let limit = tr.doc.nodeSize - 2;

						tr.doc.nodesBetween(0, limit, (node, pos, parent) => {
							if (node.type.name === 'wordNode') {
								newPosMap.push({
									...node.attrs,
									startPos: pos,
									node,
									endPos: pos + node.nodeSize
								});
							}
						});

						return {
							set: state.set.map(tr.mapping, tr.doc),
							lastPos: state.lastPos,
							posMap: newPosMap
						};
					}
				}
			},
			props: {
				handleDOMEvents: {
					progress: (view, event) => {
						// console.log("plugin", event)
						return true;
					}
				},
				handleClick(view, pos, event) {
					// Check if we clicked on a Word node
					const $pos = view.state.doc.resolve(pos);
					const node = view.state.doc.nodeAt(pos);

					// Also check parent in case we clicked on text inside the Word node
					let wordNode = null;
					if (node && node.type.name === 'wordNode') {
						wordNode = node;
					} else {
						// Check if parent is a Word node
						const parent = $pos.parent;
						const parentPos = $pos.before($pos.depth);
						const parentNode = view.state.doc.nodeAt(parentPos);
						if (parentNode && parentNode.type.name === 'wordNode') {
							wordNode = parentNode;
						}
					}

					if (wordNode) {
						const attrs = wordNode.attrs;
						if (attrs.start !== null && attrs.start !== undefined && ws && ws.player) {
							ws.player.seek(attrs.start);
							return true; // We handled the click
						}
					}
					return false; // Let other handlers process the click
				},
				decorations(state) {
					return wordColorAI.getState(state).set;
				}
			}
		});
		return [wordColorAI];
	}
});
