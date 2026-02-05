<script lang="ts">
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { _ } from 'svelte-i18n';
	import { enhance } from '$app/forms';

	let email = $state('');
	let password = $state('');
	let fullName = $state('');
	let confirmPassword = $state('');
	let error = $state();
	let confirmPasswordInputRef = $state();

	let { ...props } = $props();

</script>

<form  method="POST" action="?/login" class="space-y-5 {props.class}" use:enhance={({ cancel }) => {
    return async ({ result }) => {
		error = null;
		if (password !== confirmPassword) {
			error = $_('signup.passwordsDontMatch');
			(confirmPasswordInputRef as HTMLInputElement)?.focus();
			cancel();
			return;
		}

    };
  }}>
  	<p>Data: {props.data} Form: {props.form} </p>
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
	{#if error}
		<p class="text-red-600 text-sm font-semibold">{error}</p>
	{/if}
	<Button type="submit">{$_('signup.register')}</Button>
</form>
