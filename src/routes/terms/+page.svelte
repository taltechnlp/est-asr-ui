<script lang="ts">
	import { _, json } from 'svelte-i18n';

	// A block is a paragraph or a bulleted list.
	type Section = { h: string; blocks: (string | { list: string[] })[] };

	const sections = $derived(($json('terms.sections') as Section[] | undefined) ?? []);
</script>

<svelte:head>
	<title>{$_('terms.title')}</title>
</svelte:head>

<h1 class="max-w-xl mx-auto mt-8 text-2xl font-extrabold">{$_('terms.h1')}</h1>
<div class="max-w-xl mx-auto mt-8">
	{#each sections as section}
		<h2 class="mb-2 text-xl font-extrabold">{section.h}</h2>
		<div class="mb-8">
			{#each section.blocks as block}
				{#if typeof block !== 'string'}
					<ul class="mb-2 ml-6 list-disc">
						{#each block.list as item}
							<li class="mb-1">{item}</li>
						{/each}
					</ul>
				{:else}
					<p class="mb-2">{block}</p>
				{/if}
			{/each}
		</div>
	{/each}
	<p class="mb-2 mt-3 font-extrabold">{$_('terms.validFrom')}</p>
</div>

<footer class="footer footer-center p-10 bg-[#13070C] rounded text-white mt-52">
	<div class="grid grid-flow-col gap-4">
		<a href="/contact" class="link link-hover">{$_('index.contact')}</a>
		<a href="/terms" class="link link-hover">{$_('index.terms')}</a>
	</div>
	<a href="https://taltech.ee/tarkvarateaduse-instituut" target="_blank">
		<img src="/taltech-logo-cutout.svg" alt="TalTech" />
	</a>
</footer>
