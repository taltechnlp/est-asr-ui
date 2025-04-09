<script lang="ts">
	import { _ } from 'svelte-i18n';
	// No need for userState store if using Auth.js session data primarily
	// import { userState } from '$lib/stores.svelte';
	// import github from 'svelte-awesome/icons/github';
	// No need for page store if using PageData prop
    // import { page } from "$app/stores";
	import { page } from "$app/state"
    import { onMount } from "svelte";
    import { goto, invalidate } from '$app/navigation';
	import { signIn } from "@auth/sveltekit/client"
	// Import PageData type which includes data from load and form actions
	import type { PageData, ActionData } from './$types';
	import Input from '$lib/components/Input.svelte';

	import Facebook from "@auth/sveltekit/providers/facebook"
	import Google from "@auth/sveltekit/providers/google"
	import MicrosoftEntraID from "@auth/sveltekit/providers/microsoft-entra-id"

	import { CredentialsSignin, OAuthAccountNotLinked } from "@auth/core/errors";

	// Get data from load function and form actions using runes
	let { data }: { data: PageData & { form?: ActionData } } = $props();

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
	// Local variables for form inputs, potentially pre-filled from form action failure
	let email = $state(data.form?.email || "");
  	let password = $state("");
	let clientSideErrorCode = "";

	// Derived state to determine the error code to display
	// Prioritize form action error, then URL error
	let displayErrorCode = $derived(data.form?.error || data.urlError?.code || clientSideErrorCode);

	// Function to translate error codes into user-friendly messages
	const printError = (code: string | undefined | null): string => {
		console.log("[printError] Called with code:", code);
		if (!code) return "";

		if (code === 'OAuthAccountNotLinked') {
			return $_('signin.errorOAuthAccountNotLinked');
		} else if (code === 'CredentialsSignin') {
			console.log("[printError] Translating CredentialsSignin");
			return $_('signin.errorInvalidCredentials');
		} else if (code === 'passwordError') {
			return $_('signin.passwordError');
		} else if (code === 'emailError') {
			return $_('signin.emailError');
		} else if (code === 'noPasswordSetError') {
			return $_('signin.noPasswordSet');
		} else if (code === 'SigninFailed') {
			return $_('signin.errorSigninFailed');
		} else if (code === 'NetworkError') {
			return $_('signin.errorNetwork');
		}
		console.warn("[printError] Displaying unknown error code:", code);
		return $_('signin.errorUnknown') + ` (${code})`;
	};

	// Client-side login function
	async function logIn(provider: string | undefined) {
		clientSideErrorCode = "";
		console.log("[logIn] Attempting sign in with provider:", provider);

		if (!provider) {
			console.error("[logIn] Provider is undefined");
			clientSideErrorCode = "UnknownProvider";
			return;
		}

		try {
			// For credentials provider, handle the error directly without redirect
			if (provider === 'credentials') {
				// First, check if credentials are valid before attempting sign-in
				if (!email || !password) {
					clientSideErrorCode = email ? "passwordError" : "emailError";
					return;
				}
				
				// Attempt sign-in with redirect:false
				const result = await signIn(provider, {
					redirect: false,
					email,
					password
				});
				
				console.log("[logIn] Raw credentials result:", result);
				const res = await result.json();
				console.log("[logIn] Raw credentials result:", res);
				// Check for error in URL
				if (result && result.ok && 'url' in result && result.url) {
					const url = new URL(result.url);
					const errorParam = url.searchParams.get('error');
					console.log("[logIn] Parsed errorParam from URL:", errorParam);
					
					if (errorParam) {
						// Set the error code but DON'T reload or redirect
						clientSideErrorCode = errorParam;
						return; // Important: return early to prevent page reload
					} else {
						// Success - reload to update session
						await invalidate('data:session');
						window.location.reload();
					}
				} else if (result && !result.ok) {
					clientSideErrorCode = "SigninFailed";
					return; // Important: return early
				} else if (result?.ok) {
					await invalidate('data:session');
					window.location.reload();
				}
			} 
			// For OAuth providers, use the existing logic
			else {
				const result = await signIn(provider, {
					redirect: false
				});
				
				console.log("[logIn] Raw OAuth result:", result);
				
				if (result && 'error' in result && result.error) {
					clientSideErrorCode = (result as any).error;
				} else if (result && result.ok && 'url' in result && result.url) {
					try {
						const url = new URL(result.url);
						const errorParam = url.searchParams.get('error');
						if (errorParam) {
							clientSideErrorCode = errorParam;
						} else {
							await invalidate('data:session');
							window.location.reload();
						}
					} catch (e) {
						console.error("[logIn] Error parsing URL", e);
						clientSideErrorCode = "SigninFailed";
					}
				} else if (result && !result.ok) {
					clientSideErrorCode = "SigninFailed";
				} else if (result?.ok) {
					await invalidate('data:session');
					window.location.reload();
				} else {
					console.warn("[logIn] Unexpected result structure");
					clientSideErrorCode = "SigninFailed";
				}
			}
		} catch (error) {
			console.error("[logIn] Caught exception during signIn:", error);
			clientSideErrorCode = "NetworkError";
		}
		
		console.log("[logIn] Final clientSideErrorCode:", clientSideErrorCode);
	}

	// Backup invalidation on mount (can sometimes help refresh session state)
	// You might not need this if invalidate is handled correctly after successful login
	onMount(async ()=> {
		// await invalidate('data:session');
	});

</script>

<svelte:head>
	<title>{$_('signin.header')}</title>
</svelte:head>

<div class="tabs flex justify-center">
	<a href="../signin" class="tab tab-bordered tab-lg tab-active mr-8">{$_('signin.login')}</a> <!-- Adjusted href for relative path -->
	<a href="../signup" class="tab tab-bordered tab-lg">{$_('signin.register')}</a> <!-- Adjusted href for relative path -->
</div>

<!-- Updated error display section -->
{#if displayErrorCode}
<p class="mt-3 text-red-500 text-center font-semibold">{printError(displayErrorCode)}</p>
{/if}
<!-- End updated error display section -->

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
	<!-- OAuth Buttons -->
	<div class="max-w-xl mt-7 gap-2">
		<p class="mb-1">{$_('signin.useOtherMethods')}:</p> <!-- Example i18n key -->
			<!-- Use client-side logIn function -->
			<button type="button" class="btn btn-outline gap-2" onclick={() => logIn("facebook")}>
				<div class="flex items-center justify-center pr-2">
					{@html getProviderLogo("facebook") || ""}
				</div>
				Facebook
			</button>
			<button type="button" class="btn btn-outline gap-2" onclick={() => logIn("google")}>
				<div class="flex items-center justify-center pr-2">
					{@html getProviderLogo("google") || ""}
				</div>
				Google
			</button>
			<!-- <button class="btn btn-outline gap-2" onclick={() => signIn("github")}><Icon data={github} scale={1.5}/>GitHub</button> -->
	</div>
</div>