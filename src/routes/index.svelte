<script context="module">
</script>

<script>
  import { user } from '$lib/stores';
  let myData;

  user.subscribe(value => {
    myData = value;
  });
</script>

<svelte:head>
  <title>Sinu failid | teksiks.ee </title>
</svelte:head>

<h1 class="text-4xl mb-10 font-extrabold">Mu nimi on {myData ? myData.name : "varsti selgub"}</h1>

<!-- {#each me as {name, email}}
  <div class="card text-center shadow-2xl mb-20">
    ${name}
  </div>
{/each} -->