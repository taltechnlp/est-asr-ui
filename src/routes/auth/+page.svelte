<script>
    import { signIn, signOut } from "@auth/sveltekit/client"
    import { page } from "$app/stores"
    import { onMount } from "svelte";
    import { goto, invalidateAll } from '$app/navigation';
    async function logIn() {
        console.log("Logging in", $page.data.session)
        if ($page.data.session) {
          const response = await fetch('/auth', {
            method: 'POST',
            body: JSON.stringify($page.data.session),
            headers: {
              'Content-Type': 'application/json'
            }
          }).catch(e => console.error("Signin failed"));
          if (response) {
            await invalidateAll()
            await goto('/files')
          };
        }
    }
    onMount(async ()=> await logIn())
  </script>
  
  <h1>SvelteKit Auth Example</h1>
  <p>
    {#if $page.data.session}
      {#if $page.data.session.user?.image}
        <span
          style="background-image: url('{$page.data.session.user.image}')"
          class="avatar"
        />
      {/if}
      <span class="signedInText">
        <small>Signed in as</small><br />
        <strong>{$page.data.session.user?.name ?? "User"}</strong>
        <span>{JSON.stringify($page.data)}</span>
      </span>
      <button on:click={() => signOut()} class="button">Sign out</button>
    {:else}
      <span class="notSignedInText">You are not signed in</span>
      <button on:click={() => signIn("github")}>Sign In with GitHub</button>
      <span class="notSignedInText">You are not signed in</span>
      <button on:click={() => signIn("facebook")}>Sign In with Facebook</button>
      <span class="notSignedInText">You are not signed in</span>
      <button on:click={() => signIn("google")}>Sign In with Google</button>
    {/if}
  </p>