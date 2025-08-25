import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core';

export interface PronHighlightOptions {
	multicolor: boolean;
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		pronHighlight: {
			/**
			 * Set a highlight mark
			 */
			setPronHighlight: (attributes?: {
				id: string;
				color: string;
				annolabel: string;
				annovalue: string;
				class: string;
			}) => ReturnType;
			/**
			 * Toggle a highlight mark
			 */
			togglePronHighlight: (attributes?: {
				id: string;
				color: string;
				annolabel: string;
				annovalue: string;
				class: string;
			}) => ReturnType;
			/**
			 * Unset a highlight mark
			 */
			unsetPronHighlight: () => ReturnType;
		};
	}
}

export const inputRegex = /(?:^|\s)((?:==)((?:[^~=]+))(?:==))$/;
export const pasteRegex = /(?:^|\s)((?:==)((?:[^~=]+))(?:==))/g;

export const PronHighlight = Mark.create<PronHighlightOptions>({
	name: 'pronHighlight',

	marks: '_',

	addOptions() {
		return {
			multicolor: true,
			HTMLAttributes: {}
		};
	},

	priority: 900,

	addAttributes() {
		if (!this.options.multicolor) {
			return {};
		}

		return {
			id: {},
			color: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-color') || element.style.backgroundColor,
				renderHTML: (attributes) => {
					if (!attributes.color) {
						return {};
					}

					return {
						'data-color': attributes.color,
						style: `border-color: ${attributes.color};`
					};
				}
			},
			annolabel: {
				default: null,
				parseHTML: (element) => element.getAttribute('annolabel'),
				renderHTML: (attributes) => {
					return { annolabel: attributes.annolabel };
				}
			},
			annovalue: {},
			class: {}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'mark'
			}
		];
	},

	renderHTML({ HTMLAttributes, mark }) {
		return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
	},

	addCommands() {
		return {
			setPronHighlight:
				(attributes) =>
				({ commands }) => {
					return commands.setMark(this.name, attributes);
				},
			togglePronHighlight:
				(attributes) =>
				({ commands }) => {
					return commands.toggleMark(this.name, attributes);
				},
			unsetPronHighlight:
				() =>
				({ commands }) => {
					return commands.unsetMark(this.name);
				}
		};
	},

	addKeyboardShortcuts() {
		return {
			'Mod-Shift-h': () => this.editor.commands.togglePronHighlight()
		};
	},

	addInputRules() {
		return [
			markInputRule({
				find: inputRegex,
				type: this.type
			})
		];
	},

	addPasteRules() {
		return [
			markPasteRule({
				find: pasteRegex,
				type: this.type
			})
		];
	}
});
