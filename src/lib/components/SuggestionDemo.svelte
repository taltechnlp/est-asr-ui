<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor, EditorContent, createEditor } from 'svelte-tiptap';
	import type { Readable } from 'svelte/store';
	import Document from '@tiptap/extension-document';
	import Text from '@tiptap/extension-text';
	import Paragraph from '@tiptap/extension-paragraph';
	import { Suggestion } from './nodes/suggestion';
	import { Word } from './marks/word';

	let editor: Readable<Editor> | undefined = undefined;

	onMount(() => {
		editor = createEditor({
			extensions: [
				Document,
				Paragraph,
				Text,
				Word,
				Suggestion
			],
			content: `<p>This is a sample text. Select any word and click "Add Suggestion" to mark it for correction, or use "Load Mock Content" to see the suggestion system in action.</p>`,
			editorProps: {
				attributes: {
					class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none border-2 border-gray-300 rounded-lg p-4'
				}
			}
		});
	});

	onDestroy(() => {
		if (editor && $editor) {
			$editor.destroy();
		}
	});

	// Demo functions to show how to use the suggestion system
	const addSuggestion = () => {
		if (editor && $editor) {
			const { from, to } = $editor.state.selection;
			const selectedText = $editor.state.doc.textBetween(from, to);
			
			if (selectedText.trim()) {
				// Mock suggestions - in real use, these would come from a spellcheck API
				const mockSuggestions = getMockSuggestions(selectedText.trim());
				
				$editor.commands.setSuggestion({
					originalText: selectedText,
					suggestions: mockSuggestions,
					start: from,
					end: to
				});
			}
		}
	};

	const getMockSuggestions = (word: string): string[] => {
		// Mock spellcheck suggestions
		const suggestionMap: { [key: string]: string[] } = {
			'mispelled': ['misspelled', 'miss-spelled', 'mis-spelled'],
			'wrnog': ['wrong', 'wrote', 'wrung'],
			'teh': ['the', 'tea', 'ten'],
			'recieve': ['receive', 'receiver', 'received'],
			'seperately': ['separately', 'separately'],
			'occured': ['occurred', 'occur', 'occurrence']
		};
		
		return suggestionMap[word.toLowerCase()] || ['correct', 'suggestion', 'example'];
	};

	const addMockSuggestions = () => {
		if (editor && $editor) {
			// Clear the editor and add plain text first
			const content = `This text contains several mispelled words. Please check teh spelling and fix recieve accordingly. The words should be corrected seperately and the error occured yesterday.`;
			
			$editor.commands.setContent(`<p>${content}</p>`);
			
			// Wait for content to be set, then programmatically add suggestions
			setTimeout(() => {
				const wordsToCorrect = [
					{ word: 'mispelled', suggestions: ['misspelled', 'miss-spelled', 'mis-spelled'] },
					{ word: 'teh', suggestions: ['the', 'tea', 'ten'] },
					{ word: 'recieve', suggestions: ['receive', 'receiver', 'received'] },
					{ word: 'seperately', suggestions: ['separately'] },
					{ word: 'occured', suggestions: ['occurred', 'occur', 'occurrence'] }
				];
				
				// Find positions of words to replace (in reverse order to avoid position shifts)
				const replacements: Array<{start: number, end: number, word: string, suggestions: string[]}> = [];
				
				wordsToCorrect.forEach(({ word, suggestions }) => {
					const doc = $editor.state.doc;
					
					doc.descendants((node, pos) => {
						if (node.isText && node.text && node.text.includes(word)) {
							const text = node.text;
							const wordIndex = text.indexOf(word);
							
							if (wordIndex !== -1) {
								const wordStart = pos + wordIndex;
								const wordEnd = wordStart + word.length;
								
								replacements.push({
									start: wordStart,
									end: wordEnd,
									word: word,
									suggestions: suggestions
								});
								return false; // Stop after first match for this word
							}
						}
					});
				});
				
				// Sort replacements by position (descending) to avoid position conflicts
				replacements.sort((a, b) => b.start - a.start);
				
				// Apply all replacements in a single transaction
				if (replacements.length > 0) {
					const tr = $editor.state.tr;
					
					replacements.forEach(({ start, end, word, suggestions }) => {
						const suggestionNode = $editor.schema.nodes.suggestion.create({
							originalText: word,
							suggestions: suggestions,
							start: start,
							end: end
						});
						
						tr.replaceWith(start, end, suggestionNode);
					});
					
					$editor.view.dispatch(tr);
				}
			}, 100);
		}
	};
</script>

<div class="p-6 max-w-4xl mx-auto">
	<h1 class="text-2xl font-bold mb-4">Suggestion NodeView Demo</h1>
	
	<div class="mb-4 space-x-2">
		<button 
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			onclick={addSuggestion}
		>
			Add Suggestion (Select text first)
		</button>
		
		<button 
			class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
			onclick={addMockSuggestions}
		>
			Load Mock Content with Suggestions
		</button>
	</div>

	<div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
		<h3 class="font-semibold mb-2">How to use:</h3>
		<ol class="list-decimal list-inside space-y-1 text-sm">
			<li>Select any text in the editor and click "Add Suggestion" to mark it as needing correction</li>
			<li>Click on any yellow highlighted text to see correction suggestions</li>
			<li>Choose a suggestion to apply the correction</li>
			<li>Click "Ignore" to keep the original text</li>
			<li>Use "Load Mock Content" to see predefined examples</li>
		</ol>
	</div>

	{#if editor}
		<EditorContent editor={$editor} />
	{/if}

	<div class="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
		<h3 class="font-semibold mb-2">Integration Notes:</h3>
		<ul class="list-disc list-inside space-y-1 text-sm text-gray-700">
			<li>The suggestion system preserves word timing attributes when replacing text</li>
			<li>Multiple words can be grouped into a single suggestion</li>
			<li>Suggestions can be populated from any spellcheck or AI service</li>
			<li>The UI is designed to be non-intrusive and accessible</li>
		</ul>
	</div>
</div>

<style>
	:global(.ProseMirror) {
		min-height: 200px;
		padding: 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 0.5rem;
		outline: none;
	}

	:global(.ProseMirror:focus) {
		border-color: #3b82f6;
	}
</style> 