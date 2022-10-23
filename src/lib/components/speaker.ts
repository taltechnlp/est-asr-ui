import { Node, nodeInputRule, mergeAttributes } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import { text } from 'svelte/internal';
import SpeakerSelect from './SpeakerSelect.svelte';

export interface SpeakerOptions {
	HTMLAttributes: Record<string, any>;
}
declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		speaker: {
			setSpeaker: () => ReturnType;
		};
	}
}
export const Speaker = Node.create<SpeakerOptions>({
	name: 'speaker',
	group: 'block',
	priority: 1100,
	content: 'inline*',
	parseHTML() {
		return [
			{
				tag: 'speaker'
			}
		];
	},
	addOptions() {
		return {
			HTMLAttributes: {}
		};
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
	},
	addAttributes() {
		return {
			'data-name': '',
			id: "" 
		};
	},
	addNodeView() {
		return SvelteNodeViewRenderer(SpeakerSelect);
	}
});
