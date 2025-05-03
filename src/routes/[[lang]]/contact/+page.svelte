<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<svelte:head>
	<title>{$_('contact.title')}</title>
</svelte:head>

<h1 class="max-w-xl mx-auto mt-8 text-2xl font-extrabold">{$_('contact.title')}</h1>
<div class="max-w-xl mx-auto mt-8">
	<h2 class="mb-2 text-xl font-extrabold">{$_('contact.taltechLab')}</h2>
	<p class="mb-10">
		<a class="link" href="https://taltech.ee/en/laboratory-language-technology"
			>https://taltech.ee/en/laboratory-language-technology</a
		>
	</p>
	<h2 class="mb-2 text-xl font-extrabold">{$_('contact.taltechLabContacts')}</h2>
	<p class="mb-10">
		<a class="link" href="https://taltech.ee/kontaktid/keeletehnoloogia-laboratoorium"
			>https://taltech.ee/kontaktid/keeletehnoloogia-laboratoorium</a
		>
	</p>
	<h2 class="mb-2 text-xl font-extrabold">{$_('contact.serviceSupport')}</h2>
	<p class="mb-2">{$_('contact.serviceSupportDetails')}</p>
	<p class="mb-10">
		<span class="link">aivo.olev[@]taltech.ee</span>
	</p>
	<h2 class="mb-2 text-xl font-extrabold">{$_('contact.finnishService')}</h2>
	<p class="mb-2">{$_('contact.finnishServiceDetails')}</p>
	<p class="mb-10">
		<span class="link">kielipankki[@]csc.fi </span>
	</p>
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
