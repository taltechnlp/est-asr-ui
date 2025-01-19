<script lang="ts">
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import type { LayoutData } from './$types'
	
	export let data: LayoutData;
	
</script>

<svelte:head> 
</svelte:head>

<div class="w-full flex justify-center">
	<Nav language={data.language} />
</div>

<main class="">
	<slot />
</main>