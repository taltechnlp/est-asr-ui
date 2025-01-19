<script lang='ts'>
	import { _ } from 'svelte-i18n';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { enhance } from '$app/forms';
	import type {PageData, ActionData} from './$types';
	import { user as userStore } from '$lib/stores';
	
	export let data: PageData;
	let email = data.email;
	let fullName = data.name;
	let password = '';
	let confirmPassword = '';
	let error;
	let confirmPasswordInputRef;
	let success = false;

	export let form: ActionData;
	
</script>

<svelte:head>
	<title>{$_('signup.header')}</title>
</svelte:head>

<div class="tabs flex justify-center">
	<a href="signin" class="tab tab-bordered tab-lg mr-8">Logi sisse</a>
	<a href="signup" class="tab tab-bordered tab-lg tab-active">Registreeru</a>
</div>
{#if (error)}
	<p class="mt-3 text-red-500 text-center font-semibold">{error}</p>
{/if}
{#if !success}
<form  method="POST" action="?/register" class="space-y-5 max-w-xl mx-auto mt-8" use:enhance={({ form:ActionData, data: PageData, cancel }) => {
	if (password !== confirmPassword) {
		error = $_('signup.passwordsDontMatch');
		confirmPasswordInputRef.focus();
		cancel();
		return;
	} 
    return async ({ result }) => {
		console.log(result)
		// @ts-ignore
		if (result.type === "failure") {
			success = false;
			if (result.data && result.data.email && result.data.exists) {
				error = $_('signup.userExists');
			}
			else if (result.data && result.data.email && result.data.invalid) {
				error = $_('signup.emailIncorrect');
			}
		}
		else if (result.type === 'success') {
			error = "";
			success = true;
			// @ts-ignore
			userStore.set(result.user);
			await setTimeout(()=>{}, 3000);
			window.location.href = '/files';
		} 

    };
  }}> 
	<Input label={$_('signup.email')} id="email" name="email" type="email" bind:value={email} />
	<Input
		label={$_('signup.name')}
		id="name"
		name="name"
		type="text"
		bind:value={fullName}
	/>
	<Input
		label={$_('signup.password')}
		id="password"
		name="password"
		type="password"
		bind:value={password}
	/>
	<Input
		label={$_('signup.passwordConfirm')}
		id="confirm-password"
		name="confirm-password"
		type="password"
		bind:value={confirmPassword}
		bind:inputRef={confirmPasswordInputRef}
	/>
	<Button type="submit">{$_('signup.register')}</Button>
</form>
{:else}
<p class="space-y-5 max-w-xl mx-auto mt-8">	{$_('signup.success')} </p>
{/if}

