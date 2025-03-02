import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { waveform } from '$lib/stores.svelte';

let ws;
waveform.subscribe((w) => {
	ws = w;
});

export const Annotation = Extension.create({
	name: 'annotation',
	addProseMirrorPlugins() {
		let annotation = new Plugin({
			key: new PluginKey('annotation'),
			state: {
				init(plugins, editorState) {
					let lastPos = 0;
					let posMap = [];
					let posOffset = 0;
					let limit = editorState.doc.nodeSize - 2;
					editorState.doc.nodesBetween(0, limit, (node, pos, parent) => {
						if (node.marks && node.marks.length > 0) {
							const mark = node.marks.find((x) => x.type.name === 'pronHighlight');
							if (mark) {
								// console.log(mark);
								posMap.push({
									...mark.attrs,
									startPos: pos + posOffset,
									node,
									endPos: pos + posOffset + node.nodeSize
								});
							}
						}
					});
					return { set: DecorationSet.create(editorState.doc, []), lastPos, posMap };
				},
				apply(tr, state, oldState, newState) {
					if (tr.getMeta('pron')) {
						const { color, annovalue } = tr.getMeta('pron');
						// console.log(color, annovalue);
						const annotations = [];
						let limit = newState.doc.nodeSize - 2;
						newState.doc.nodesBetween(0, limit, (node, pos, parent) => {
							if (node.marks && node.marks.length > 0) {
								const mark = node.marks.find((x) => x.type.name === 'pronHighlight');
								if (mark) {
									// console.log(mark, node, pos, limit);
									annotations.push(
										Decoration.inline(pos, pos + 5, { style: 'color: green' }),
										Decoration.widget(pos, (view, getPos) => {
											const an = document.createElement('div');
											an.className = 'tooltip';
											an.textContent = annovalue;
											an.style.display = '';
											let from = pos;
											let to = (pos = 5);
											// These are in screen coordinates
											let start = view.coordsAtPos(from),
												end = view.coordsAtPos(to);
											// The box in which the tooltip is positioned, to use as base
											const domNode = view.domAtPos(pos).node;
											let box = domNode.parentElement.offsetParent.getBoundingClientRect();
											// Find a center-ish x position from the selection endpoints (when
											// crossing lines, end may be more to the left)
											let left = Math.max((start.left + end.left) / 2, start.left + 3);
											an.style.left = /* (left - box.left) */ 100 + 'px';
											an.style.bottom = /* (box.bottom - start.top) */ 100 + 'px';
											return an;
										})
									);
								}
							}
						});
						// console.log(annotations);
						return {
							set: DecorationSet.create(tr.doc, annotations),
							posMap: state.posMap
						};
					} else
						return {
							set: state.set.map(tr.mapping, tr.doc),
							lastPos: state.lastPos,
							posMap: state.posMap
						};
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
					// console.log(event, pos, view)
					// console.log("A key was pressed!", view, event)
					if (
						view.state.doc.nodeAt(pos) &&
						view.state.doc.nodeAt(pos).marks &&
						view.state.doc.nodeAt(pos).marks[0]
					) {
						const attrs = view.state.doc.nodeAt(pos).marks[0].attrs;
						if (attrs.start && ws && ws.getDuration() > 0)
							ws.seekTo(attrs.start / ws.getDuration());
						// console.log(attrs.start / ws.getDuration());
						// console.log(ws.seekTo(attrs.start / ws.getDuration()) /* ws.seekTo(attrs.start / ws.getDuration()) */)
					}
					// console.log(pos, view.state.doc.nodeAt(pos).marks, view.state.doc.resolve(pos).textOffset, view.state.doc.nodeAt(pos).nodeSize)

					return true; // We did not handle this
				},
				decorations(state) {
					return annotation.getState(state).set;
				}
			}
		});
		return [annotation];
	}
});
