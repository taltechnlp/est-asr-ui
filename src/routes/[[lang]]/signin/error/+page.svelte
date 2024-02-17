<script lang="ts">
	import type { PageData } from './$types';
	import { _ } from 'svelte-i18n';
	// import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	export let data: PageData;
	// onMount(async () => await invalidateAll())
</script>

<svelte:head>
	<title>{$_('auth.title')}</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_640px)] m-1">
		{#if data.error}
			<div class="alert alert-error shadow-lg">
				<div>
					<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current flex-shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/></svg
					>
					{#if data.error && (data.error === 'AccessDenied' || data.error === 'AccountNotLinked' || data.error === 'CallbackRouteError')}
						<span>{$_('auth.' + data.error)}</span>
					{:else if data.error}
						<span>{$_('auth.otherError')}</span>
					{/if}
				</div>
				<a href="/me">
					<button class="btn btn-sm btn-outline">{$_('auth.back')}</button>
				</a>
			</div>
		{/if}
	<div class="mt-10" />
</div>
