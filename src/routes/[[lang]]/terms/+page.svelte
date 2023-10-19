<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<svelte:head>
	<title>{$_('terms.title')}</title>
</svelte:head>

<h1 class="max-w-xl mx-auto mt-8 text-2xl font-extrabold">{$_('terms.h1')}</h1>
<div class="max-w-xl mx-auto mt-8">
	<h2 class="mb-2 text-xl font-extrabold">{$_('terms.serviceProvider')}</h2>
	<p class="mb-2">
		{$_('terms.terms1')}
	</p>
	<p class="mb-10">
		{$_('terms.terms2')}
	</p>
	<p class="mb-2 text-xl font-extrabold">{$_('terms.h1')}</p>
	<p class="mb-2">
		{$_('terms.terms3')}
	</p>
	<p class="mb-2">
		{$_('terms.terms4')}
	</p>
	<p class="mb-2">
		{$_('terms.terms5')}
	</p>
	<p class="mb-2">
		{$_('terms.terms6')}
	</p>
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
