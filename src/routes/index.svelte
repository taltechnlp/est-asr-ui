<script context="module">
</script>

<script>
	import { user } from '$lib/stores';
	import Hero from '$lib/components/Hero.svelte'
	import { _ } from 'svelte-i18n'

	let myData;

	user.subscribe((value) => {
		myData = value;
	});

	
</script>

<svelte:head>
	<title>{$_('index.title')}</title>
</svelte:head>



<div class="flex flex-row w-full mt-40 mb-12 justify-center m-1 p-1">
	<div class="grid grid-cols-2 place-items-left flex-grow max-w-screen-2xl">
		<div class="">
			<h1 class="text-4xl mb-10 font-extrabold mt-12">Kõnetuvastus ehk kõne tekstiks
			</h1>
			<p class="text-2xl">Rakendus eesti- ja soomekeelsete helisalvestiste automaatseks trankskribeerimiseks ning tuvastusvigade korrigeerimiseks.</p>
		</div>
		<div class="grid place-items-center flex-grow p-5"><Hero></Hero></div>
	</div>
</div>

<div class="">
	<h1>Kuidas see töötab?</h1>
	<p>This is a prototype of Estonian neural speech synthesis developed by the NLP research group at the University of Tartu. The model has been trained on Estonian news and literature corpora. The system is currently able to imitate the speech of six different speakers. Although the project is not finished and we still have a lot of work to do, we can already see that a neural speech synthesis model sounds much more natural when compared to previous approaches.</p>
</div>

Nõuanded

Avalik API

Panustamine

Vabavara

Teadus


<footer class="footer footer-center p-10 bg-base-200 text-base-content rounded">
	<div class="grid grid-flow-col gap-4">
		<a class="link link-hover">About us</a>
		<a class="link link-hover">Contact</a>
		<a class="link link-hover">Kasutustingimused</a>
	</div>
	<div>
		<div class="grid grid-flow-col gap-4">
			
		</div>
	</div>
	<div>
		<p>https://taltech.ee/en/laboratory-language-technology</p>
	</div>
</footer>

<!-- {#each me as {name, email}}
  <div class="card text-center shadow-2xl mb-20">
    ${name}
  </div>
{/each} -->
