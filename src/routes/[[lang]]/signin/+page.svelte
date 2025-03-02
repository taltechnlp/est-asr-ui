<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { userState } from '$lib/stores.svelte';
	// import github from 'svelte-awesome/icons/github';
    import { page } from "$app/state"
    import { onMount } from "svelte";
    import { goto, invalidate } from '$app/navigation';
	import { signIn } from "@auth/sveltekit/client"
	import type { PageProps } from './$types';
	import Input from '$lib/components/Input.svelte';

	import Facebook from "@auth/sveltekit/providers/facebook"
	import Google from "@auth/sveltekit/providers/google"
	import MicrosoftEntraID from "@auth/sveltekit/providers/microsoft-entra-id"

	const providers = [
		Google,
		Facebook,
		MicrosoftEntraID,
	]
	const getProviderLogo = (providerName) => {
		switch (providerName.toLowerCase()) {
		case "google":
			return `<svg class="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
			<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
			<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
			<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
			</svg>`
		case "facebook":
			return `<svg class="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669c1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
			</svg>`
		case "microsoft entra id":
			return `<svg class="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/>
			</svg>`
		default:
			return ""
		}
	}
	
	let error = $state(null);
	let email = ""
  	let password = ""

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
			userState.name = user.name;
			userState.id = user.id;
			userState.email = user.email;
			await invalidate("/")
			await goto('/files', { invalidateAll: true })
		}
	}
	const printError = (error) => {
		if (error === 'passwordError') {
			return $_('signin.passwordError');
		} else if (error === 'emailError') {
			return $_('signin.emailError')
		} else if (error === 'noPasswordSetError') {
			return $_('signin.noPasswordSet')
		}
		else return error;
	};
	let { data, form }: PageProps = $props();
	let errorCode = $state("");
	async function logIn(provider) {
		let error = false;
		errorCode = "";
		let res, body;
		if (provider === "credentials") {
			res = await signIn(provider, { redirect: false, email, password }).catch((e)=>{
				error = true;
				console.log("signin failed", e);
			});
			try {
				body = await res.json();
			}
			catch (e) {
				error = true;
				console.log("Failed to parse signin response.");
			};
			// console.log(res, body)
		} else {
			res = await signIn(provider, { redirect: false}).catch((e)=>{
				error = true;
				console.log("signin failed", e);
				// errorCode = "otherSigninError";
			});
			// console.log("signin result", res)
		}
		if (!error && body && body.url)	{
			const searchParams = new URLSearchParams(body.url);
			for (const p of searchParams) {
				if (p[0] === "code") {
					errorCode = p[1];
					// console.log(p[1]);
				}
			}
		}
		if (!errorCode) {
			await invalidate('data:session');
			await invalidate('/api/files');
			await goto('/files');
		}
    }
	// Backup when returning from various auth redirects
	onMount(async ()=> {
		await invalidate('data:session');
		if (data.email) await goto('/files');
	})

</script>

<svelte:head>
	<title>{$_('signin.header')}</title>
</svelte:head>

<div class="tabs flex justify-center">
	<a href="signin" class="tab tab-bordered tab-lg tab-active mr-8">{$_('signin.login')}</a>
	<a href="signup" class="tab tab-bordered tab-lg">{$_('signin.register')}</a>
</div>
{#if errorCode}
<p class="mt-3 text-red-500 text-center font-semibold">{printError(errorCode)}</p>
{/if}

<div 
	class="w-full"
	>
	<div class="space-y-5 max-w-xl mx-auto mt-8">
		<Input
			label={$_('signin.email')}
			id="email"
			name="email"
			type="email"
			bind:value={email}
			required
		/>
		<Input
			label={$_('signin.password')}
			id="password"
			name="password"
			type="password"
			bind:value={password}
			required
		/>
		<div class="flex place-content-between w-96">
			<button type="submit" onclick={() => logIn("credentials")} class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
				{$_('signin.login')}
			</button>
			<a href="password-reset">{$_('signin.forgotPassword')}</a>
		</div>
	</div>
</div>

<div class="flex justify-center">
	<div class="max-w-xl mt-7 gap-2">
		<p class="mb-1">Või kasuta sisenemiseks:</p>		
			<button class="btn btn-outline gap-2" onclick={() => logIn("facebook")}>
				<div class="flex items-center justify-center pr-2">
					{@html getProviderLogo("facebook") || ""}
				</div>
				Facebook
			</button>
			<button class="btn btn-outline gap-2" onclick={() => logIn("google")}>
				<div class="flex items-center justify-center pr-2">
					{@html getProviderLogo("google") || ""}
				</div>
				Google
			</button>
			<!-- <button class="btn btn-outline gap-2" onclick={() => signIn("github")}><Icon data={github} scale={1.5}/>GitHub</button> -->
	</div>
</div>