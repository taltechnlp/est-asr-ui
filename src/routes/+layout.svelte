<script lang="ts">
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import { locale } from 'svelte-i18n';
    import { browser } from '$app/environment';
	import type { LayoutData } from './$types'
	
	interface Props {
		data: LayoutData;
		children?: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();
	
	let currentTheme = $state('cmyk'); // default to our custom theme
	// Nice themes: Bumblebee, Emerald, Valentine (kui valitav), Fantasy, CMYK, Night (UI needs change first)
	$effect(() => {
		if (browser && data.language && $locale !== data.language) {
			// Add this log:
			console.log(`[Layout.svelte] Detected language change. Current locale: ${$locale}, New language from data: ${data.language}. Setting locale.`);
			locale.set(data.language);
		}
	});
</script>

<svelte:head> 
</svelte:head>

<div class="w-full flex justify-center bg-base-100" data-theme={currentTheme}>
	<Nav language={data.language} bind:value={currentTheme} />
</div>

<main class="" data-theme={currentTheme}>
	{@render children?.()}
</main>