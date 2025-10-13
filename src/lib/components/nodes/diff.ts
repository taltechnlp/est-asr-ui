import { Node, mergeAttributes } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import DiffNode from './DiffNode.svelte';

export interface DiffOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		diff: {
			insertDiff: (attributes: {
				id: string;
				originalText: string;
				suggestedText: string;
				changeType: string;
				confidence: number;
				context?: string;
			}) => ReturnType;
			approveDiff: (diffId: string) => ReturnType;
			rejectDiff: (diffId: string) => ReturnType;
		};
	}
}

export const Diff = Node.create<DiffOptions>({
	name: 'diff',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	draggable: false,

	addOptions() {
		return {
			HTMLAttributes: {}
		};
	},

	addAttributes() {
		return {
			id: {
				default: '',
				parseHTML: (element) => element.getAttribute('data-diff-id'),
				renderHTML: (attributes) => {
					if (!attributes.id) {
						return {};
					}
					return {
						'data-diff-id': attributes.id
					};
				}
			},
			originalText: {
				default: '',
				parseHTML: (element) => element.getAttribute('data-original-text'),
				renderHTML: (attributes) => {
					if (!attributes.originalText) {
						return {};
					}
					return {
						'data-original-text': attributes.originalText
					};
				}
			},
			suggestedText: {
				default: '',
				parseHTML: (element) => element.getAttribute('data-suggested-text'),
				renderHTML: (attributes) => {
					if (!attributes.suggestedText) {
						return {};
					}
					return {
						'data-suggested-text': attributes.suggestedText
					};
				}
			},
			changeType: {
				default: 'substitution', // 'deletion' | 'substitution' | 'insertion'
				parseHTML: (element) => element.getAttribute('data-change-type'),
				renderHTML: (attributes) => {
					if (!attributes.changeType) {
						return {};
					}
					return {
						'data-change-type': attributes.changeType
					};
				}
			},
			confidence: {
				default: 0,
				parseHTML: (element) => {
					const confidence = element.getAttribute('data-confidence');
					return confidence ? parseFloat(confidence) : 0;
				},
				renderHTML: (attributes) => {
					if (!attributes.confidence) {
						return {};
					}
					return {
						'data-confidence': attributes.confidence.toString()
					};
				}
			},
			context: {
				default: '',
				parseHTML: (element) => element.getAttribute('data-context'),
				renderHTML: (attributes) => {
					if (!attributes.context) {
						return {};
					}
					return {
						'data-context': attributes.context
					};
				}
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-diff-id]'
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'span',
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				class: 'diff-node'
			})
		];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(DiffNode);
	},

	addCommands() {
		return {
			insertDiff:
				(attributes) =>
				({ commands }) => {
					return commands.insertContent({
						type: this.name,
						attrs: attributes
					});
				},

			approveDiff:
				(diffId: string) =>
				({ tr, state, dispatch }) => {
					let diffNode: any = null;
					let diffPos = -1;

					// Find the diff node with the given ID
					state.doc.descendants((node, pos) => {
						if (node.type.name === 'diff' && node.attrs.id === diffId) {
							diffNode = node;
							diffPos = pos;
							return false; // Stop searching
						}
					});

					if (!diffNode || diffPos === -1) {
						return false;
					}

					if (!dispatch) return true;

					// Handle speaker changes differently
					if (diffNode.attrs.changeType === 'speaker_change') {
						// Find the speaker node containing this diff
						let speakerNode: any = null;
						let speakerPos = -1;

						state.doc.descendants((node: any, pos: number) => {
							if (
								node.type.name === 'speaker' &&
								pos <= diffPos &&
								pos + node.nodeSize >= diffPos + diffNode.nodeSize
							) {
								speakerNode = node;
								speakerPos = pos;
								return false; // Stop searching
							}
						});

						if (speakerNode && speakerPos !== -1) {
							// Update speaker attribute
							tr.setNodeMarkup(speakerPos, null, {
								...speakerNode.attrs,
								'data-name': diffNode.attrs.suggestedText
							});

							// Remove the diff node
							tr.delete(diffPos, diffPos + diffNode.nodeSize);
							return true;
						}
					}

					// Handle text replacement (default case)
					const suggestedText = diffNode.attrs.suggestedText;

					// Replace the diff node with the suggested text
					// Try to preserve any marks that were on the original text
					const marks = state.doc.resolve(diffPos).marks();
					const textNode = state.schema.text(suggestedText, marks);

					tr.replaceWith(diffPos, diffPos + diffNode.nodeSize, textNode);

					return true;
				},

			rejectDiff:
				(diffId: string) =>
				({ tr, state, dispatch }) => {
					let diffNode: any = null;
					let diffPos = -1;

					// Find the diff node with the given ID
					state.doc.descendants((node, pos) => {
						if (node.type.name === 'diff' && node.attrs.id === diffId) {
							diffNode = node;
							diffPos = pos;
							return false; // Stop searching
						}
					});

					if (!diffNode || diffPos === -1) {
						return false;
					}

					if (!dispatch) return true;

					// For speaker changes, just remove the diff node (keep original speaker)
					if (diffNode.attrs.changeType === 'speaker_change') {
						tr.delete(diffPos, diffPos + diffNode.nodeSize);
						return true;
					}

					// Replace the diff node with the original text
					const originalText = diffNode.attrs.originalText;

					// Preserve marks if any
					const marks = state.doc.resolve(diffPos).marks();
					const textNode = state.schema.text(originalText, marks);

					tr.replaceWith(diffPos, diffPos + diffNode.nodeSize, textNode);

					return true;
				}
		};
	}
});
