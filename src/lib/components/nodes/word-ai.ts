import { Node, mergeAttributes } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import WordNodeComponent from './WordNode.svelte';
import { v4 as uuidv4 } from 'uuid';

export interface WordNodeOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		wordNode: {
			insertWord: (attributes: {
				text: string;
				start?: number;
				end?: number;
				id?: string;
				lang?: string;
			}) => ReturnType;
			updateWordTiming: (id: string, start: number, end: number) => ReturnType;
		};
	}
}

export const WordNode = Node.create<WordNodeOptions>({
	name: 'wordNode',
	group: 'inline',
	content: 'text*',
	inline: true,
	selectable: true,
	draggable: false,

	// Not atomic - allows cursor inside word for editing
	atom: false,

	addOptions() {
		return {
			HTMLAttributes: {}
		};
	},

	addAttributes() {
		return {
			start: {
				default: null,
				parseHTML: (element) => {
					const start = element.getAttribute('data-start');
					return start ? parseFloat(start) : null;
				},
				renderHTML: (attributes) => {
					if (attributes.start === null || attributes.start === undefined) {
						return {};
					}
					return {
						'data-start': attributes.start.toString()
					};
				}
			},
			end: {
				default: null,
				parseHTML: (element) => {
					const end = element.getAttribute('data-end');
					return end ? parseFloat(end) : null;
				},
				renderHTML: (attributes) => {
					if (attributes.end === null || attributes.end === undefined) {
						return {};
					}
					return {
						'data-end': attributes.end.toString()
					};
				}
			},
			id: {
				default: () => uuidv4().substring(36 - 12),
				parseHTML: (element) => element.getAttribute('data-id'),
				renderHTML: (attributes) => {
					if (!attributes.id) {
						return {};
					}
					return {
						'data-id': attributes.id
					};
				}
			},
			lang: {
				default: 'et',
				parseHTML: (element) => element.getAttribute('data-lang') || 'et',
				renderHTML: (attributes) => {
					return {
						'data-lang': attributes.lang || 'et'
					};
				}
			},
			spellcheck: {
				default: 'false',
				parseHTML: (element) => element.getAttribute('spellcheck') || 'false',
				renderHTML: (attributes) => {
					return {
						spellcheck: attributes.spellcheck || 'false'
					};
				}
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-word-node]'
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'span',
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				'data-word-node': '',
				class: 'word-node inline',
				style: 'display: inline; cursor: pointer;'
			}),
			0
		];
	},

	// Don't use custom node view - let ProseMirror handle inline rendering
	// addNodeView() {
	//   return SvelteNodeViewRenderer(WordNodeComponent);
	// },

	addCommands() {
		return {
			insertWord:
				(attributes) =>
				({ commands }) => {
					const { text, ...attrs } = attributes;
					return commands.insertContent({
						type: this.name,
						attrs,
						content: text ? [{ type: 'text', text }] : undefined
					});
				},

			updateWordTiming:
				(id: string, start: number, end: number) =>
				({ tr, state, dispatch }) => {
					let updated = false;

					state.doc.descendants((node, pos) => {
						if (node.type.name === 'wordNode' && node.attrs.id === id) {
							if (dispatch) {
								tr.setNodeMarkup(pos, null, {
									...node.attrs,
									start,
									end
								});
							}
							updated = true;
							return false; // Stop searching
						}
					});

					return updated;
				}
		};
	},

	// Handle merging and splitting of word nodes
	addKeyboardShortcuts() {
		return {
			// Space key to create new word node
			Space: ({ editor }) => {
				const { from, to } = editor.state.selection;
				const text = editor.state.doc.textBetween(from - 1, from);

				// Only handle if we're at the end of a word node
				if (text && text !== ' ') {
					// Insert a space followed by a new empty word node
					editor
						.chain()
						.insertContent(' ')
						.insertContent({
							type: 'wordNode',
							content: []
						})
						.run();
					return true;
				}
				return false;
			}
		};
	}
});
