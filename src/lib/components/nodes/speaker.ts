import { Node, mergeAttributes } from '@tiptap/core';
// import { TextSelection } from 'prosemirror-state';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
// import { text } from 'svelte/internal';
import Segment from './Segment.svelte';
import { waveform } from '$lib/stores.svelte';

let ws;
waveform.subscribe(w => {
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
			topic: "",
			alternatives: "" // JSON string of Alternative[] for this segment 
		};
	},
	addNodeView() {
		return SvelteNodeViewRenderer(Segment);
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
