import { Node, mergeAttributes } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import { v4 as uuidv4 } from "uuid";
import SuggestionView from './SuggestionView.svelte';

export interface SuggestionOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		suggestion: {
			setSuggestion: (attributes?: { 
				originalText: string; 
				suggestions: string[];
				start?: number;
				end?: number;
				wordIds?: string[];
			}) => ReturnType;
			unsetSuggestion: () => ReturnType;
			applySuggestion: (suggestionText: string) => ReturnType;
		};
	}
}

export const Suggestion = Node.create<SuggestionOptions>({
	name: 'suggestion',
	group: 'block',
	priority: 1100,
	content: 'inline*',

	addOptions() {
		return {
			HTMLAttributes: {}
		};
	},

	addAttributes() {
		return {
			originalText: {
				default: ''
			},
			suggestions: {
				default: []
			},
			start: {
				default: null
			},
			end: {
				default: null
			},
			id: {
				default: () => uuidv4().substring(32 - 12)
			},
			lang: {
				default: "et"
			},
			wordIds: {
				default: []
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-suggestion]'
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ['span', mergeAttributes({ 'data-suggestion': 'true' }, HTMLAttributes), 0];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(SuggestionView);
	},

	addCommands() {
		return {
			setSuggestion: (attributes) => ({ commands, state, dispatch }) => {
				const { selection } = state;
				const { from, to } = selection;
				
				if (dispatch) {
					const selectedText = state.doc.textBetween(from, to);
					
					if (selectedText.trim()) {
						// Create a suggestion node with the selected text and suggestions
						const suggestionNode = this.type.create({
							originalText: selectedText,
							suggestions: attributes?.suggestions || [],
							start: attributes?.start || from,
							end: attributes?.end || to
						});
						
						const transaction = state.tr.replaceWith(from, to, suggestionNode);
						dispatch(transaction);
					}
				}
				
				return true;
			},
			
			unsetSuggestion: () => ({ commands, state, dispatch }) => {
				const { selection } = state;
				const { from, to } = selection;
				
				if (dispatch) {
					const node = state.doc.nodeAt(from);
					if (node && node.type.name === 'suggestion') {
						// Restore the original text
						const originalText = node.attrs.originalText || '';
						const transaction = state.tr.replaceWith(
							from, 
							from + node.nodeSize, 
							state.schema.text(originalText)
						);
						dispatch(transaction);
					}
				}
				
				return true;
			},
			
			applySuggestion: (suggestionText) => ({ state, dispatch }) => {
				const { selection } = state;
				const { from, to } = selection;
				
				if (dispatch) {
					const node = state.doc.nodeAt(from);
					if (node && node.type.name === 'suggestion') {
						// Replace with the suggested text
						const transaction = state.tr.replaceWith(
							from,
							from + node.nodeSize,
							state.schema.text(suggestionText)
						);
						dispatch(transaction);
					}
				}
				
				return true;
			}
		};
	}
});