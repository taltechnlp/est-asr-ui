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
	group: 'inline',
	inline: true,
	content: 'inline*',
	priority: 1100,

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
				tag: 'span[data-suggestion]',
				getAttrs: (element) => {
					if (element instanceof HTMLElement) {
						return {
							originalText: element.getAttribute('data-original-text') || '',
							suggestions: JSON.parse(element.getAttribute('data-suggestions') || '[]'),
						};
					}
					return {};
				}
			}
		];
	},

	renderHTML({ HTMLAttributes, node }) {
		return [
			'span', 
			mergeAttributes(
				{ 
					'data-suggestion': 'true',
					'data-original-text': node.attrs.originalText,
					'data-suggestions': JSON.stringify(node.attrs.suggestions),
					'style': 'display: inline;'
				}, 
				HTMLAttributes
			), 
			0
		];
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
						// Extract the selected content to preserve any marks (like word marks)
						const selectedContent = state.doc.slice(from, to).content;
						
						// Create a suggestion node with the selected content and suggestions
						const suggestionNode = this.type.create({
							originalText: selectedText,
							suggestions: attributes?.suggestions || [],
							start: attributes?.start || from,
							end: attributes?.end || to
						}, selectedContent);
						
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
						// Restore the original content with any preserved marks
						const originalContent = node.content;
						const transaction = state.tr.replaceWith(
							from, 
							from + node.nodeSize, 
							originalContent
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
						// Replace with the suggested text, preserving any marks from the original content
						let newContent;
						
						// Check if the original content had marks we should preserve
						if (node.content && node.content.firstChild && node.content.firstChild.marks) {
							// Apply the same marks to the new text
							newContent = state.schema.text(suggestionText, node.content.firstChild.marks);
						} else {
							newContent = state.schema.text(suggestionText);
						}
						
						const transaction = state.tr.replaceWith(
							from,
							from + node.nodeSize,
							newContent
						);
						dispatch(transaction);
					}
				}
				
				return true;
			}
		};
	}
});