<script lang="ts">
	export const ssr = false;
	import Tiptap from '$lib/components/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
	import { content, words, speakers } from './content';
	import { speakerNames as speakerNamesStore, words as wordsStore, editorMounted } from '$lib/stores';
	const file = {
		json: content,
		id: 1,
		name: 'demo.mp3'
	};
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words)
</script>

<svelte:head>
	<title>Demo | tekstiks.ee</title>
</svelte:head>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<Tiptap content={file.json} fileId={file.id} demo={true} />
		<Player url={`/${file.name}`} />
	</div>
</main>
