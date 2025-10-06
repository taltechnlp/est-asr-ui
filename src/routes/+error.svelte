<script lang="ts">
	import { page } from '$app/stores';
	import { _ } from 'svelte-i18n';
	import '../app.css';

	// Get the error status from the page store
	$: status = $page.status;
	$: message = $page.error?.message || 'An unexpected error occurred';

	// Get translated error info based on status code
	$: errorKey = [404, 401, 403, 500, 503].includes(status) ? status.toString() : 'default';
	$: title = $_(`error.${errorKey}.title`);
	$: description = $_(`error.${errorKey}.description`);
</script>

<svelte:head>
	<title>{status} - {title}</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-base-100" data-theme="cmyk">
	<div class="text-center px-6 py-12 max-w-2xl">
		<!-- Error code -->
		<div class="text-9xl font-bold text-primary opacity-20 mb-4">
			{status}
		</div>

		<!-- Error title -->
		<h1 class="text-4xl font-bold text-base-content mb-4">
			{title}
		</h1>

		<!-- Error description -->
		<p class="text-xl text-base-content/70 mb-8">
			{description}
		</p>

		<!-- Optional detailed error message in development -->
		{#if message && import.meta.env.DEV}
			<div class="bg-error/10 border border-error/20 rounded-lg p-4 mb-8 text-left">
				<p class="text-sm text-error font-mono break-words">
					{message}
				</p>
			</div>
		{/if}

		<!-- Action buttons -->
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<a href="/" class="btn btn-primary">
				{$_('error.goHome')}
			</a>
			<button onclick={() => history.back()} class="btn btn-ghost">
				{$_('error.goBack')}
			</button>
		</div>
	</div>
</div>
