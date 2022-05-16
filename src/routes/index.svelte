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
			<a href="/">Tekstiks.ee</a>{$_('index.tekstiksIntro')}
			<span class="text-red-700">{$_('index.tekstiksIntroRemark')}</span>
		</p>
		<div class="grid md:grid-cols-2 grid-cols-1 gap-10 mb-10">
			<img class="screenshot" src="/static/screenshot_demo.png" alt="Ekraanitõmmis rakendusest" />
			<div class="mw-400px flex flex-col">
				<h4>{$_('index.step1')}</h4>
				<p>{$_('index.step1Desc')}</p>
				<h4>{$_('index.step2')}</h4>
				<p>{$_('index.step2Desc')}</p>
				<h4>{$_('index.step3')}</h4>
				<p>{$_('index.step3Desc')}</p>
				<h4>{$_('index.step4')}</h4>
				<p>{$_('index.step4Desc')}</p>
			</div>
		</div>
	</div>
</div>

<div class="flex flex-row w-full justify-center pl-1 pr-1 bg-[#EFF9F0]">
	<div class="grid place-items-center max-w-screen-xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">{$_('index.recommendations')}</h1>
		<ul class="mb-10 list-disc">
			<li>
				{$_('index.rec1')}
			</li>
			<li>
				{$_('index.rec2')}
			</li>
			<li>
				{$_('index.rec3')}
			</li>
			<li>
				<span class="badge badge-md">NB!</span>
				{$_('index.rec4')}
			</li>
		</ul>
	</div>
</div>

<div class="flex flex-row w-full justify-center pl-1 pr-1 ">
	<div class="grid place-items-center max-w-screen-xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">{$_('index.citing')}</h1>
		<p class="mb-10">
			{$_('index.citing1')}
			<a class="link" target="_blank" href="https://ebooks.iospress.nl/volumearticle/50297"
				>{$_('index.citing2')}</a
			>): Alumäe, Tanel; Tilk, Ottokar; Asadullah. "Advanced Rich Transcription System for Estonian
			Speech" Baltic HLT 2018.
		</p>
	</div>
</div>

<div class="flex w-full justify-center pl-1 pr-1 bg-[#EFF9F0]">
	<div class="grid place-items-center max-w-screen-xl">
		<h1 class="text-2xl mb-10 font-extrabold mt-12">{$_('index.os')}</h1>
		<p class="mb-5 justify-self-start">
			<a class="link" href="/">Tekstiks.ee</a>
			{$_('index.osDesc')}
		</p>
		<ul class="list-disc ml-5 mb-10">
			<li>
				{$_('index.osASR')}
				<a class="link" target="_blank" href="https://github.com/taltechnlp/est-asr-pipeline"
					>https://github.com/taltechnlp/est-asr-pipeline</a
				>
			</li>
			<li>
				{$_('index.osServer')}
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
