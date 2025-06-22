import { Mark, mergeAttributes } from '@tiptap/core';

export interface DiffOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		diff: {
			setDiff: (attributes?: { type?: 'addition' | 'deletion'; reason?: string }) => ReturnType;
			unsetDiff: () => ReturnType;
			toggleDiff: (attributes?: { type?: 'addition' | 'deletion'; reason?: string }) => ReturnType;
		};
	}
}

export const Diff = Mark.create<DiffOptions>({
	name: 'diff',

	priority: 1000,

	marks: '_',

	defaultOptions: {
		HTMLAttributes: {}
	},

	addAttributes() {
		return {
			type: {
				default: 'addition',
				parseHTML: element => element.getAttribute('data-diff-type') || 'addition',
				renderHTML: attributes => {
					return {
						'data-diff-type': attributes.type
					};
				}
			},
			reason: {
				default: '',
				parseHTML: element => element.getAttribute('data-diff-reason') || '',
				renderHTML: attributes => {
					return {
						'data-diff-reason': attributes.reason
					};
				}
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-diff-type]'
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		const { type, reason, ...otherAttrs } = HTMLAttributes;
		
		const baseAttrs = {
			'data-diff-type': type,
			'data-diff-reason': reason,
			class: type === 'addition' ? 'diff-addition' : 'diff-deletion'
		};

		return ['span', mergeAttributes(baseAttrs, otherAttrs)];
	},

	addCommands() {
		return {
			setDiff:
				(attributes = {}) =>
				({ commands }) => {
					return commands.setMark(this.name, { type: 'addition', ...attributes });
				},
			unsetDiff:
				() =>
				({ commands }) => {
					return commands.unsetMark(this.name);
				},
			toggleDiff:
				(attributes = {}) =>
				({ commands }) => {
					return commands.toggleMark(this.name, { type: 'addition', ...attributes });
				}
		};
	}
}); 