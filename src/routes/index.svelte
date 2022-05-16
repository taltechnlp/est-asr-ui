<script context="module">
</script>

<script>
	import { user } from '$lib/stores';
	import Hero from '$lib/components/Hero.svelte';
	import { _ } from 'svelte-i18n';

	let myData;
	let loggedIn;

	user.subscribe((value) => {
		myData = value;
		if (value && value.name) {
			loggedIn = true;
		} else loggedIn = false;
	});
</script>

<svelte:head>
	<title>{$_('index.title')}</title>
</svelte:head>

<div class="flex flex-col w-full pl-1 pr-1 pt-5 pb-7 justify-center hero z-20 ">
	<h1 class="text-4xl mb-10 font-extrabold mt-12">{$_('index.heroHeader')}</h1>
	<p class="text-2xl">
		{$_('index.heroDescription')}
	</p>
	<div>
		<a href={loggedIn ? '/files' : '/signin'} class="btn btn-primary btn-lg mt-6 "
			>{$_('index.ctaButton')}</a
		>
		<a href="/demo" class="btn btn-outline btn-lg mt-6 ml-2 text-white">{$_('index.demoButton')}</a>
	</div>
</div>

<div class="flex flex-row w-full justify-center pl-1 pr-1 ">
	<div class="grid place-items-center max-w-screen-2xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">{$_('index.howItWorks')}</h1>
		<p class="mb-10">
			<a href="/">Tekstiks.ee</a> on TTÜ kõnetehnoloogia labori avalik kõnetuvastuse teenus. Süsteem
			kasutab meie laboris väljatöötatud tehnoloogiat ja mudeleid, mis annavad eesti keele
			tuvastamisel seni oluliselt parimaid tulemusi kui kommertslikud alternatiivid. Süsteem on
			täisautomaatne ja samaaegselt võimeline töötlema mitut salvestist. Sellegi poolest võib
			tööpäevadel esineda suuremat koormust ning pikemat ooteaega. Järjekorra puudumisel kulub
			kõnetuvastusele ligi pool kõnesalvestise kestusest.
			<span class="text-red-700"
				>Lähiajal lisandub võimalus ka näha töötlemise progressi ning ennustatavat valmimise aega.</span
			>
		</p>
		<div class="grid md:grid-cols-2 grid-cols-1 gap-10 mb-10">
			<img class="screenshot" src="/static/screenshot_demo.png" alt="Ekraanitõmmis rakendusest" />
			<div class="mw-400px flex flex-col">
				<h4>1. Lae kõnesalvestis ülesse</h4>
				<p>Toetatud on enamlevinud heli- ja videoformaadid. Maksimaalne suurus on 500MB</p>
				<h4>2. Oota teksti valmimist</h4>
				<p>
					Masinõppe meetoditega treenitud süsteem otsib kõigepealt eestikeelset kõne ning kõnelejate
					vahetumisi, seejärel transkribeerib kõne tekstiks ning lõpuks lisab kirjavahemärgid.
					Mitmed tuntud eestlased identifitseerib süsteem ka nimeliselt.
				</p>
				<h4>3. Paranda tuvastusvead</h4>
				<p>
					Teksti redigeerimine on interaktiivne. Heli mängides värvub hetkel kuuldaolev sõna, mis
					aitab keerulisemad kohad üle kuulata ja seeläbi teksti käsitsi korrigeerida.
				</p>
				<h4>4. Laadi tulemus alla</h4>
				<p>Toetatud on DOCX formaat.</p>
			</div>
		</div>
	</div>
</div>

<div class="flex flex-row w-full justify-center pl-1 pr-1 bg-[#EFF9F0]">
	<div class="grid place-items-center max-w-screen-xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">Nõuanded</h1>
		<ul class="mb-10 list-disc">
			<li>
				Helifailis olev kõne peaks olema võimalikult hea kvaliteediga, s.t. lindistatud suu lähedal
				oleva mikrofoniga müravabas keskkonnas. Helifail peaks olema vähemalt 16-bit kodeeringus ja
				16 KHz sagedusega, eelistatult WAV formaadis.
			</li>
			<li>
				Kuna maksimaalne üleslaetava faili suurus on 500 MB, siis võib pikemad WAV-failid kodeerida
				mp3 või ogg vormingusse, aga soovitav on siis kasutada vähemalt 128 kbit kodeeringut. Mahtu
				aitab kokku hoida ka stereovormingu muutmine monoks (tuvastuse käigus tehakse seda nagunii).
			</li>
			<li>
				Süsteem ei tööta hästi kahest tunnist pikemate helifailidega. Selliste failidega võib
				tuvastus ebaõnnetuda ja tuvastustulemust siis kasutajale ei saadata. Soovitame pikad failid
				eelnevalt tükeldada.
			</li>
			<li>
				<span class="badge badge-md">NB!</span> Kuna tuvastusserveri ressurss on piiratud, siis palume
				mitte üles laadida rohkem kui 10 salvestust päevas. Vastasel juhul tekib süsteemis pikk järjekord
				kõikide kasutajate jaoks. Kui vajate väga paljude failide (näit. terve heliarhiivi) transkribeerimist,
				siis kontakteeruge meiega.
			</li>
		</ul>
	</div>
</div>

<div class="flex flex-row w-full justify-center pl-1 pr-1 ">
	<div class="grid place-items-center max-w-screen-xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">Viitamine</h1>
		<p class="mb-10">
			Kui kasutate seda süsteemi teadustööks, siis palun viidata oma publikatsioonides alltoodud
			artiklile (saadaval <a
				class="link"
				target="_blank"
				href="https://ebooks.iospress.nl/volumearticle/50297">siin</a
			>): Alumäe, Tanel; Tilk, Ottokar; Asadullah. "Advanced Rich Transcription System for Estonian
			Speech" Baltic HLT 2018.
		</p>
	</div>
</div>

<div class="flex w-full justify-center pl-1 pr-1 bg-[#EFF9F0]">
	<div class="grid place-items-center max-w-screen-xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">Vabavara</h1>
		<p class="mb-5 justify-self-start">
			<a class="link" href="/">Tekstiks.ee</a> põhineb vabavaralistel lahendustel, mida on lihtne ise
			ülesse seada. Tuvastussüsteemi saab kasutada ka Docker konteineri baasil (soovituslik).
		</p>
		<ul class="list-disc ml-5 mb-10">
			<li>
				Kõnetuvastuse süsteem. Toimib samm-sammulise protsessina, mille sammude läbimist on võimalik
				jälgida. Käivitatav käsurealt.
				<a class="link" target="_blank" href="https://github.com/taltechnlp/est-asr-pipeline"
					>https://github.com/taltechnlp/est-asr-pipeline</a
				>
			</li>
			<li>
				Veebiserveri lahendus, mille abil saab luua lihtsa API, mille kaudu kõnetuvastust kasutada.
				Toetab ka reaalajas töötlemise progressi tagastamist.
				<a class="link" target="_blank" href="https://github.com/taltechnlp/est-asr-backend"
					>https://github.com/taltechnlp/est-asr-backend</a
				>
			</li>
		</ul>
	</div>
</div>

<footer class="footer footer-center p-10 bg-[#13070C] rounded text-white">
	<div class="grid grid-flow-col gap-4">
		<a href="/contact" class="link link-hover">{$_('index.contact')}</a>
		<a href="/terms" class="link link-hover">{$_('index.terms')}</a>
	</div>
	<a href="https://taltech.ee/tarkvarateaduse-instituut" target="_blank">
		<img src="/static/taltech-logo-cutout.svg" alt="TalTech" />
	</a>
</footer>

<style>
	.hero {
		color: white;
		background: url(/static/wave.svg) center center / contain no-repeat #6b4d57;
		background-blend-mode: multiply;
	}
	.screenshot {
		width: 800px;
		margin-right: 2rem;
		object-fit: scale-down;
	}
	h4 {
		color: #fe621d;
		font-size: 1.5rem;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}
</style>
