<script lang="ts">
	import ProseMirrorEditor from '$lib/components/editor/ProseMirrorEditor.svelte';
	import Player from '$lib/components/Player.svelte';
	import { content, words, speakers } from '../demo/content';
	import { speakerNames as speakerNamesStore, words as wordsStore, editorMounted } from '$lib/stores.svelte';

	const file = {
		json: content,
		id: 1,
		name: 'Päevakaja 16.05.mp3',
		uploadedAt: new Date(22, 5, 22)
	};

	let editor: ProseMirrorEditor;

	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words);

	// Handle word clicks from the editor to control media playback
	function handleWordClick(event: CustomEvent) {
		const { timecode, identifier } = event.detail;
		console.log('Demo: Word clicked', { timecode, identifier });
		
		// Here you would seek the media player to the timecode
		// For demo purposes, we'll just log it
		// Note: We don't highlight on click - that's only for media playback
	}

	// Example of how to control highlighting from external media player
	function simulateMediaProgress() {
		// This simulates what would happen when media playback progresses
		// In a real implementation, this would be triggered by the media player
		const sampleWordIds = ['word1', 'word2', 'word3'];
		let currentIndex = 0;
		
		setInterval(() => {
			if (editor) {
				const wordId = sampleWordIds[currentIndex % sampleWordIds.length];
				editor.highlightWordById(wordId);
				currentIndex++;
			}
		}, 2000);
	}

	// Start the simulation after a delay
	setTimeout(simulateMediaProgress, 3000);
</script>

<svelte:head>
	<title>ProseMirror Demo | tekstiks.ee</title>
	<meta name="description" content="Demo of the new ProseMirror-based transcription editor" />
</svelte:head>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<div class="max-w-5xl mx-auto p-4">
			<div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
				<h2 class="text-lg font-semibold text-blue-800 mb-2">ProseMirror Editor Demo</h2>
				<p class="text-blue-700">
					This is the new ProseMirror-based transcription editor. Key features:
				</p>
				<ul class="list-disc list-inside text-blue-700 mt-2">
					<li>Direct ProseMirror implementation for maximum control</li>
					<li>Custom schema for transcription data</li>
					<li>Interactive word components using Svelte 5</li>
					<li>Real-time highlighting synchronized with media playback</li>
					<li>Freely editable word nodes with metadata (timecode, identifier)</li>
					<li><strong>Fully editable:</strong> Edit text directly like normal text editor</li>
				</ul>
				<p class="text-blue-700 mt-2">
					<strong>Usage:</strong> Click and edit text directly like a normal text editor. 
					Words will automatically highlight (yellow) during simulated media playback. Delete and add text freely.
				</p>
			</div>
		</div>
		
		<ProseMirrorEditor 
			bind:this={editor}
			content={file.json} 
			fileId={file.id} 
			demo={true} 
			fileName={file.name} 
			uploadedAt={file.uploadedAt}
			on:wordclick={handleWordClick}
		/>
		
		<Player url={`/${file.name}`} />
	</div>
</main>

<style>
	/* Additional demo-specific styles */
</style> 