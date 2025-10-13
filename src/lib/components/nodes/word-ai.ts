import { Node, mergeAttributes } from '@tiptap/core';

export interface WordNodeOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		wordNode: {
			insertWord: (attributes: {
				text: string;
				wordIndex?: number;
			}) => ReturnType;
		};
	}
}

/**
 * Simplified WordNode without timing attributes.
 * Timing data is now managed by wordTimingPlugin.
 */
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
			wordIndex: {
				default: null,
				parseHTML: (element) => {
					const index = element.getAttribute('data-word-index');
					return index !== null ? parseInt(index, 10) : null;
				},
				renderHTML: (attributes) => {
					if (attributes.wordIndex === null || attributes.wordIndex === undefined) {
						return {};
					}
					return {
						'data-word-index': attributes.wordIndex.toString()
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
				style: 'display: inline;'
			}),
			0
		];
	},

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
				}
		};
	}
});
