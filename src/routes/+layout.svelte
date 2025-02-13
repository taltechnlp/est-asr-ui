<script lang="ts">
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import type { LayoutData } from './$types'
	
	interface Props {
		data: LayoutData;
		children?: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();
	
</script>

<svelte:head> 
</svelte:head>

<div class="w-full flex justify-center">
	<Nav language={data.language} />
</div>

<main class="">
	{@render children?.()}
</main>