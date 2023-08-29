<script lang="ts">
	import SignInForm from '$lib/components/SignInForm.svelte';
	import { _ } from 'svelte-i18n';
	import { user as userStore } from '$lib/stores';
	import { signIn, signOut } from "@auth/sveltekit/client"
	import github from 'svelte-awesome/icons/github';
	import facebook from 'svelte-awesome/icons/facebook';
	import google from 'svelte-awesome/icons/google';
	import Icon from 'svelte-awesome/components/Icon.svelte';
    import { page } from "$app/stores"
    import { onMount } from "svelte";
    import { goto, invalidate } from '$app/navigation';
	
	let error = null;

	async function handleSubmit({detail: {email, password}}) {
		const response = await fetch('/api/signin', {
			method: 'POST',
			body: JSON.stringify({email, password}),
			headers: {
				'Content-Type': 'application/json'
			}
		}).catch(e => console.error("Signin failed"));
		if (!response) {
			error = "Signin request failed!";
			return;
		}
		if (!response.ok) {
			error = (await response.json()).message;
			return;
		}
		else {
			const user = await response.json()
			console.log("setting user store", user)
			userStore.set(user);
			H.identify('jay@highlight.io', {
				id: user.id
			});
			await goto('/files')
		}
		/* try {
			await signIn('credentials', {}, {email: "", password: ""});
		}
		catch (e) {
			console.log("Error is", e)
		} */
	}
	const printError = (error) => {
		if (error === 'password') {
			return $_('signin.passwordError');
		} else if (error === 'email') {
			return $_('signin.emailError')
		} else if (error === 'noPasswordSet') {
			return $_('signin.noPasswordSet')
		}
		else return error;
	};

	async function logIn() {
        if ($page.data.session) {
            await invalidate("/")
            await goto('/files')
        } 
    }
    onMount(async ()=> await logIn())
</script>

<svelte:head>
	<title>{$_('signin.header')}</title>
</svelte:head>

<div class="tabs flex justify-center">
	<a href="signin" class="tab tab-bordered tab-lg tab-active mr-8">{$_('signin.login')}</a>
	<a href="signup" class="tab tab-bordered tab-lg">{$_('signin.register')}</a>
</div>
{#if error}
<p class="mt-3 text-red-500 text-center font-semibold">{printError(error)}</p>
{/if}
<SignInForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />
<div class="flex justify-center">
	<div class="max-w-xl mt-7 gap-2">
		<p class="mb-1">Või kasuta sisenemiseks:</p>		
			<button class="btn btn-outline gap-2" on:click={() => signIn("facebook")}><Icon data={facebook} scale={1.5}/>Facebook</button>
			<button class="btn btn-outline gap-2" on:click={() => signIn("google")}><Icon data={google} scale={1.5}/>
				Google</button>
			<button class="btn btn-outline gap-2" on:click={() => signIn("github")}><Icon data={github} scale={1.5}/>GitHub</button>
	</div>
	
</div>