<script lang='ts'>
	import { _ } from 'svelte-i18n';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { enhance } from '$app/forms';
	import type {PageData, ActionData} from './$types';
	import { userState } from '$lib/stores.svelte';
	import { goto } from '$app/navigation';
	
	let { data, form } = $props();
	let email = $state(data.email);
	let fullName = $state(data.name);
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state();
		$effect(() => {
			if (!form?.success) {
				error = "test";
			}
			else if (form?.success) {
				error = "";
				setTimeout(()=>{
					goto('/signin');
				}, 3000);
			}
		})
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
{#if !form?.success}
<form  method="POST" action="?/register" class="space-y-5 max-w-xl mx-auto mt-8" use:enhance={({ formElement, formData, action, cancel, submitter }) => {
	if (password !== confirmPassword) {
		error = $_('signup.passwordsDontMatch');
		cancel();
		return;
	} 
    /* return async ({ result }) => {
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
			success = true
			await setTimeout(()=>{}, 3000);
			window.location.href = '/files';
		} 

    }; */
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
	/>
	<Button type="submit">{$_('signup.register')}</Button>
</form>
{:else}
<p class="space-y-5 max-w-xl mx-auto mt-8">	{$_('signup.success')} </p>
{/if}

