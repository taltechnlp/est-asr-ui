<script context="module">
	import { user as userStore } from '$lib/stores';
	import { getUser } from '$lib/queries/user';
	
	export async function load({ params, fetch, session, stuff }) {
		const user = await getUser()
		if (user) userStore.set(user);
    return {
      status: 200
    };
	}
</script>

<script>
  import Nav from "$lib/nav.svelte";
  import "../app.css";
  import "../i18n"
</script>

<div class="w-full flex justify-center">  
  <Nav></Nav>
</div>


<main class="">
  <slot />
</main>