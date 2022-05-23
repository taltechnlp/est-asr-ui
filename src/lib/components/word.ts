import { Mark, markInputRule, markPasteRule, mergeAttributes, Node } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import WordNode from './WordNode.svelte';

export interface WordOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		word: {
			setWord: (attributes?: { start: number; end: number }) => ReturnType;
			unsetWord: () => ReturnType;
		};
	}
}

export const inputRegex = /(?:^|\s)((?:==)((?:[^~]+))(?:==))$/gm;
export const pasteRegex = /(?:^|\s)((?:==)((?:[^~]+))(?:==))/gm;

export const Word = Node.create<WordOptions>({
	name: 'word',
	group: 'inline',
	inline: true,
	content: 'text*',

	priority: 1000,

	defaultOptions: {
		HTMLAttributes: {}
	},

	addAttributes() {
		return {
			start: {
				default: '' /* ,
				parseHTML: (element) => {
					return element.getAttribute('start');
				},
				renderHTML: (attributes) => {
					return attributes.start;
				} */
			},
			end: {
				default: '' /* ,
				parseHTML: (element) => {
					return element.getAttribute('end');
				},
				renderHTML: (attributes) => {
					return attributes.end;
				} */
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span'
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ['span', mergeAttributes(HTMLAttributes)];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(WordNode);
	}	

	/* addInputRules() {
		return [markInputRule(inputRegex, this.type)];
	},

	addPasteRules() {
		return [markPasteRule(inputRegex, this.type)];
	} */
});
