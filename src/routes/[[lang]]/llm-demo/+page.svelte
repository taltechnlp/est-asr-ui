<script lang="ts">
	import Tiptap from '$lib/components/editor/TiptapLLM.svelte';
	import Player from '$lib/components/Player.svelte';
	import SuggestionDemo from '$lib/components/SuggestionDemo.svelte';
	import { content, words, speakers } from './content';
	import { speakerNames as speakerNamesStore, words as wordsStore, editorMounted } from '$lib/stores.svelte';
	const file = {
		json: content,
		id: 1,
		name: 'Päevakaja 16.05.mp3',
		uploadedAt: new Date(22, 5, 22)
	};
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words)
</script>

<svelte:head>
	<title>LLM demo | tekstiks.ee</title>
</svelte:head>

<main class="grid grid-rows-[1fr_auto] content-between">
	<!-- Suggestion Demo Section -->
	<div class="mt-8 border-t-2 border-gray-200 pt-8">
		<SuggestionDemo />
	</div>
	<div class="self-stretch h-full mb-96">
		<Tiptap content={file.json} fileId={file.id} demo={true} fileName={file.name} uploadedAt={file.uploadedAt} />
		<Player url={`/${file.name}`} />
	</div>
	
</main>
