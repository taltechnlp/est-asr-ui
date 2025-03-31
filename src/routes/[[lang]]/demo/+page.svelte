<script lang="ts">
	import Tiptap from '$lib/components/editor/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
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
	<title>Demo | tekstiks.ee</title>
</svelte:head>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<Tiptap content={file.json} fileId={file.id} demo={true} fileName={file.name} uploadedAt={file.uploadedAt} />
		<Player url={`/${file.name}`} dataUri={`/demo.dat`} />	
	</div>
</main>
