<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<svelte:head>
	<title>{$_('terms.title')}</title>
</svelte:head>

<h1 class="max-w-xl mx-auto mt-8 text-2xl font-extrabold">Teenuse kasutamise tingimused</h1>
<div class="max-w-xl mx-auto mt-8">
	<h2 class="mb-2 text-xl font-extrabold">Teenuse osutaja</h2>
	<p class="mb-10">
		Tekstiks.ee on avalikikult kasutatav demonstratsioon ja keskkond, kus saab kasutada Tallinna
		Tehnikaülikooli Tarkvarateaduse instituudi alla kuuluva Keeletehnoloogia laboratooriumi
		kõnetuvastuse tarkvara. Kõnetuvastuse tarkvara on vabavaraline ning kõigil on võimalus see
		iseseisvalt paigaldada ning seda seejärel samaväärselt kasutada.
	</p>
	<p class="mb-2 text-xl font-extrabold">Teenuse kasutamise tingimused</p>
	<p class="mb-2">
		Teenuse kasutamiseks on vajalik konto loomine. Kontot kasutatakse vaid, et võimaldada hilisemat
		ligipääsu ülesse laetavatele heli- ja videosalvestistele. Samuti aitab see kaitsta kõnetuvastuse
		tulemusena valmivat tekstilist transkriptsiooni ning kasutaja privaatsust.
	</p>
	<p class="mb-2">
		Andmeid hoiustatakse Tallinna Tehnikaülikooli hallatavatel serveritel. Need asuvad Eesti
		territooriumil. Kasutajal on vabadus ülesse laetud failid kustutada, mille tulmusena
		kustutatakse need üheskoos seotud tekstiliste transkriptsioonidega lõplikult.
	</p>
	<p class="mb-2">
		Süsteem ei hoiusta kasutaja kohta rohkem isikuandmeid kui registreerimisel küsitav eposti
		aadress ning nimi. Hetkel pole kasutusele võetud ka muid kasutaja käitumist jälgivaid teenuseid.
		Teenuse osutajal on vabadus neid kasutusele võtta, sel juhul täiendavat nõusolukut küsides.
	</p>
	<p class="mb-2">
		Süsteemis ülesse laetavaid andmeid võidakse kasutada süsteemi vigade lahendamise käigus süsteemi
		parendamise eesmärgil. Kõnesalvestisi ei kasutata üheskoos kasutajat identifitseerivate
		andmetega.
	</p>
	<p class="mb-2 mt-3 font-extrabold">Kasutustingimused kehtivad alates 09.05.2022</p>
</div>

<footer class="footer footer-center p-10 bg-[#13070C] rounded text-white mt-52">
	<div class="grid grid-flow-col gap-4">
		<a href="/contact" class="link link-hover">{$_('index.contact')}</a>
		<a href="/terms" class="link link-hover">{$_('index.terms')}</a>
	</div>
	<a href="https://taltech.ee/tarkvarateaduse-instituut" target="_blank">
		<img src="/static/taltech-logo-cutout.svg" alt="TalTech" />
	</a>
</footer>
