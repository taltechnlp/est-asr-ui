<script lang="ts">
	import SignInForm from '$lib/components/SignInForm.svelte';
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { user as userStore } from '$lib/stores';

	let error = null;

	async function handleSubmit({detail: {email, password}}) {
		const response = await fetch('/api/signin', {
			method: 'POST',
			body: JSON.stringify({email, password}),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			error = (await response.json()).message;
			return;
		}
		else {
			const user = await response.json()
			userStore.set(user);
			goto('/files');
		}
	}
	const printError = (error) => {
		if (error === 'password') {
			return $_('signin.passwordError');
		} else if (error === 'email') {
			return $_('signin.emailError')
		}
		else return error;
	};
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

