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
			content: `<p>See on näidistekst. Vali sõna ja klõpsa "Lisa soovitus" märkimaks see parandamiseks, või kasuta "Laadi näidissisu" et näha soovitussüsteemi töös.</p>`,
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
		// Mock spellcheck suggestions for Estonian
		const suggestionMap: { [key: string]: string[] } = {
			'valekirjutatud': ['valesti kirjutatud', 'vale-kirjutatud', 'valekirjutust'],
			'vige': ['vale', 'viga', 'vigane'],
			'see': ['seda', 'selle', 'siin'],
			'võtta': ['võtma', 'võtab', 'võetud'],
			'eralidi': ['eraldi', 'ära-lidi', 'eraldina'],
			'juhtos': ['juhtus', 'juhtu', 'juhtuma']
		};
		
		return suggestionMap[word.toLowerCase()] || ['õige', 'soovitus', 'näide'];
	};

	const addMockSuggestions = () => {
		if (editor && $editor) {
			// Clear the editor and add Estonian text first
			const content = `See tekst sisaldab mitut valekirjutatud sõna. Palun kontrolli vige kirjaviisi ja paranda võtta vastavalt. Sõnad tuleks parandada eralidi ja viga juhtos eile.`;
			
			$editor.commands.setContent(`<p>${content}</p>`);
			
			// Wait for content to be set, then programmatically add suggestions
			setTimeout(() => {
				const wordsToCorrect = [
					{ word: 'valekirjutatud', suggestions: ['valesti kirjutatud', 'vale-kirjutatud', 'valekirjutust'] },
					{ word: 'vige', suggestions: ['vale', 'viga', 'vigane'] },
					{ word: 'võtta', suggestions: ['võtma', 'võtab', 'võetud'] },
					{ word: 'eralidi', suggestions: ['eraldi'] },
					{ word: 'juhtos', suggestions: ['juhtus', 'juhtu', 'juhtuma'] }
				];
				
				// Process words sequentially to avoid conflicts
				let wordIndex = 0;
				
				const processNextWord = () => {
					if (wordIndex >= wordsToCorrect.length) return;
					
					const { word, suggestions } = wordsToCorrect[wordIndex];
					const doc = $editor.state.doc;
					
					// Find the position of the word in the document
					let found = false;
					doc.descendants((node, pos) => {
						if (!found && node.isText && node.text && node.text.includes(word)) {
							const text = node.text;
							const wordStart = pos + text.indexOf(word);
							const wordEnd = wordStart + word.length;
							
							// Select the word and create suggestion
							$editor.commands.setTextSelection({ from: wordStart, to: wordEnd });
							
							setTimeout(() => {
								$editor.commands.setSuggestion({
									originalText: word,
									suggestions: suggestions,
									start: wordStart,
									end: wordEnd
								});
								
								// Process next word
								wordIndex++;
								setTimeout(processNextWord, 50);
							}, 50);
							
							found = true;
							return false;
						}
					});
					
					if (!found) {
						// Word not found, skip to next
						wordIndex++;
						setTimeout(processNextWord, 10);
					}
				};
				
				processNextWord();
			}, 100);
		}
	};
</script>

<div class="p-6 max-w-4xl mx-auto">
	<h1 class="text-2xl font-bold mb-4">Soovituse NodeView demo</h1>
	
	<div class="mb-4 space-x-2">
		<button 
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
			onclick={addSuggestion}
		>
			Lisa soovitus (Vali kõigepealt tekst)
		</button>
		
		<button 
			class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
			onclick={addMockSuggestions}
		>
			Laadi näidissisu soovitustega
		</button>
	</div>

	<div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
		<h3 class="font-semibold mb-2">Kuidas kasutada:</h3>
		<ol class="list-decimal list-inside space-y-1 text-sm">
			<li>Vali redaktoris tekst ja klõpsa "Lisa soovitus" märkimaks see parandamiseks</li>
			<li>Klõpsa kollaselt esiletõstetud tekstil et näha parandussoovitusi</li>
			<li>Vali soovitus paranduse rakendamiseks</li>
			<li>Klõpsa "Ignoreeri" algse teksti säilitamiseks</li>
			<li>Kasuta "Laadi näidissisu" eelnevalt määratud näidete nägemiseks</li>
		</ol>
	</div>

	{#if editor}
		<EditorContent editor={$editor} />
	{/if}

	<div class="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
		<h3 class="font-semibold mb-2">Integreerimise märkused:</h3>
		<ul class="list-disc list-inside space-y-1 text-sm text-gray-700">
			<li>Soovitussüsteem säilitab sõnade ajastuse atribuudid teksti asendamisel</li>
			<li>Mitu sõna saab grupeerida ühte soovitusse</li>
			<li>Soovitusi saab täita mis tahes õigekirja- või AI-teenusest</li>
			<li>Kasutajaliides on disainitud mittesekkuvaks ja kättesaadavaks</li>
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