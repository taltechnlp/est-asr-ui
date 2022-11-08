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
				// parseHTML: element => element.getAttribute('start'),
				/* ,
				parseHTML: (element) => {
					return element.getAttribute('start');
				},*/
				/* renderHTML: (attributes) => {
					return attributes.start;
				}  */
			},
			end: {
				// IIFE to generate a 12 length unique ID 
				default: '' /* ,
				parseHTML: (element) => {
					return element.getAttribute('end');
				},
				renderHTML: (attributes) => {
					return attributes.end;
				} */
			},
			id: {
				default: uuidv4().substring(32 - 12)
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