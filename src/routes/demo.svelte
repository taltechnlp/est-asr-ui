<script context="module">
	import Tiptap from '$lib/components/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
</script>

<svelte:head>
	<title>Welcome</title>
</svelte:head>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<Tiptap content="" />
	</div>
	<div id="waveform" class="w-full h-auto fixed bottom-0 left-0 pb-1"><p></p></div> 
	<Player />
</main>
