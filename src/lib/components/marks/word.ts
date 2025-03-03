import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core';
import {v4 as uuidv4} from "uuid";

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

export const Word = Mark.create<WordOptions>({
	name: 'word',

	priority: 1000,

	marks: '_',

	defaultOptions: {
		HTMLAttributes: {}
	},

	addAttributes() {
		return {
			start: {
				default: ''
			},
			end: {
				default: '' 
			},
			id: {
				default: uuidv4().substring(32 - 12)
			},
			lang: {
				default: "et"
			},
			spellcheck: {
				default: "false"
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