<script>
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import '../i18n';
</script>

<div class="w-full flex justify-center">
	<Nav />
</div>

<main class="">
	<slot />
</main>
