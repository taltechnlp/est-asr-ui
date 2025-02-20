<script lang="ts">
	import { preventDefault } from 'svelte/legacy';

	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { _ } from 'svelte-i18n';
	import { createEventDispatcher } from 'svelte';
	interface Props {
		[key: string]: any
	}

	let { ...props }: Props = $props();

	let email = $state('');
	let password = $state('');

	const dispatch = createEventDispatcher();

	function submit() {
		dispatch('submit', {
			email,
			password
		});
	}
</script>

<form onsubmit={preventDefault(submit)} class="space-y-5 {props.class} max-w-xl mx-auto mt-8">
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
		<Button type="submit">{$_('signin.login')}</Button>
		<a href="password-reset">{$_('signin.forgotPassword')}</a>
	</div>
</form>
