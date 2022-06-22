<script>
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { _ } from 'svelte-i18n';
	import { createEventDispatcher } from 'svelte';

	let email = '';
	let password = '';
	let fullName = '';
	let confirmPassword = '';
	let error;
	let confirmPasswordInputRef;

	const dispatch = createEventDispatcher();

	function submit() {
		error = null;
		if (password !== confirmPassword) {
			error = $_('signup.passwordsDontMatch');
			confirmPasswordInputRef.focus();
			return;
		}

		dispatch('submit', {
			email,
			password,
			name: fullName
		});
	}
</script>

<form on:submit|preventDefault={submit} class="space-y-5 {$$props.class}">
	<Input label={$_('signup.email')} id="email" name="email" type="email" bind:value={email} />
	<Input
		label={$_('signup.name')}
		id="full-name"
		name="full-name"
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
