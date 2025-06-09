<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { userState } from '$lib/stores.svelte';
	// import github from 'svelte-awesome/icons/github';
    import { page } from "$app/state"
    import { onMount } from "svelte";
    import { goto, invalidate } from '$app/navigation';
	import { authClient } from "$lib/auth-client"; // Updated to use Better Auth client
	import type { PageProps } from './$types';
	import Input from '$lib/components/Input.svelte';

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
		default:
			return ""
		}
	}
	
	let error = $state(null);
	let email = $state("")
  	let password = $state("")

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
		try {
			errorCode = "";
			
			if (provider === "credentials") {
				// Use Better Auth email/password sign in
				const result = await authClient.signIn.email({
					email,
					password,
				});
				
				if (result.error) {
					errorCode = result.error.message || "loginError";
					return;
				}
			} else {
				// Use Better Auth social sign in
				await authClient.signIn.social({
					provider: provider,
					callbackURL: "/files"
				});
				return; // Social providers will redirect
			}
			
			// If we get here, login was successful
			await invalidate('data:session');
			await goto('/files');
			
		} catch (e) {
			console.error("Login failed:", e);
			errorCode = "loginError";
		}
    }
	
	// Check if user is already logged in
	onMount(async () => {
		const session = await authClient.getSession();
		if (session) {
			await goto('/files');
		}
	});

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