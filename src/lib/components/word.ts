import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core';

export interface WordOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		word: {
			/**
			 * Set start and end times
			 */
			setWord: (attributes?: { start: number; end: number }) => ReturnType;
			/**
			 * Unset a highlight mark
			 */
			unsetWord: () => ReturnType;
		};
	}
}

export const inputRegex = /(?:^|\s)((?:==)((?:[^~]+))(?:==))$/gm;
export const pasteRegex = /(?:^|\s)((?:==)((?:[^~]+))(?:==))/gm;

export const Word = Mark.create<WordOptions>({
	name: 'word',

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
	}

	/* addInputRules() {
		return [markInputRule(inputRegex, this.type)];
	},

	addPasteRules() {
		return [markPasteRule(inputRegex, this.type)];
	} */
});
