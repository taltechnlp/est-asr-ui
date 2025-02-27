<script lang="ts">
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import type { LayoutData } from './$types'
	
	interface Props {
		data: LayoutData;
		children?: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();
	
	let currentTheme = $state('mytheme'); // default to our custom theme
	// Nice themes: Bumblebee, Emerald, Valentine (kui valitav), Fantasy, CMYK, Night (UI needs change first)
</script>

<svelte:head> 
</svelte:head>

<div class="w-full flex justify-center" data-theme={currentTheme}>
	<Nav language={data.language} bind:value={currentTheme} />
</div>

<main class="" data-theme={currentTheme}>
	{@render children?.()}
</main>