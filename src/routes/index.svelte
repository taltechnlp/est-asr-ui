<script context="module">
  import { me } from '$lib/stores';
  export const load = async ({fetch}) => {
    const res = await fetch('/signin.json')
    if (res.ok) {
      const data = await res.json()
      if (data && data.user) {
        me.set(data.user)
        console.log(data.user)
      }
      return {props: {data}}
    }
    else return {}
  } 
</script>

<script>
  export let data
</script>

<svelte:head>
  <title>Sinu failid | teksiks.ee </title>
</svelte:head>

<h1 class="text-4xl mb-10 font-extrabold">Welcome to SvelteKit</h1>

<!-- {#each me as {name, email}}
  <div class="card text-center shadow-2xl mb-20">
    ${name}
  </div>
{/each} -->