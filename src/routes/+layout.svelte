<script>
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import '../i18n';
	import { onMount } from 'svelte'
	import { pwaInfo } from 'virtual:pwa-info'
	
	onMount(async () => {
		if (pwaInfo) {
		const { registerSW } = await import('virtual:pwa-register')
		registerSW({
			immediate: true,
			onRegistered(r) {
			// uncomment following code if you want check for updates
				r && setInterval(() => {
			   console.log('Checking for sw update')
			   r.update()
			}, 20000 /* 20s for testing purposes */)
			console.log(`SW Registered: ${r}`)
			},
			onRegisterError(error) {
			console.log('SW registration error', error)
			}
		})
		}
	})

	$: webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '' 
</script>

<svelte:head> 
 	{@html webManifestLink} 
</svelte:head>

<div class="w-full flex justify-center">
	<Nav />
</div>

<main class="">
	<slot />
</main>

{#await import('$lib/ReloadPrompt.svelte') then { default: ReloadPrompt}}
  <ReloadPrompt />
{/await}