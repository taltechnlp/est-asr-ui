import { Node, nodeInputRule, mergeAttributes } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import { text } from 'svelte/internal';
import SpeakerSelect from './SpeakerSelect.svelte';
import { wavesurfer } from '$lib/stores';

let ws;
wavesurfer.subscribe(w => {
    ws = w;
})

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
			id: "",
			topic: "" 
		};
	},
	addNodeView() {
		return SvelteNodeViewRenderer(SpeakerSelect);
	},
	addKeyboardShortcuts() {
		return {
			'Tab': () => {
				if (ws) {
					ws.playPause();
				}
				return true;
			},
			'Shift-Tab': () => {
				if (ws) {
					ws.skipBackward(5);
				}
				return true;
			},
			'Alt-Tab': () => {
				if (ws) {
					ws.skipForward(5);
				}
				return true;
			},
		}
	},
});
