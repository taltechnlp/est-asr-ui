<script>
	import { goto } from '$app/navigation';
	import { user as userStore } from '$lib/stores';
	import { _ } from 'svelte-i18n';
	import { signOut } from '@auth/sveltekit/client';
	import github from 'svelte-awesome/icons/github';
	import facebook from 'svelte-awesome/icons/facebook';
	import google from 'svelte-awesome/icons/google';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/stores';

	let userData;

	userStore.subscribe((value) => {
		userData = value;
	});
	const handleSignOut = async () => {
		try {
			const response = await fetch('/api/signout', {
				method: 'POST',
				body: '',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			userStore.set({ name: '', email: '', id: '' });
			// Log out of OAuth sessions
			await signOut();
			await goto('/');
		} catch (error) {
			return {
				status: 500,
				body: { error }
			};
		}
	};
</script>

<svelte:head>
	<title>{$_('me.title')}</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_640px)] m-1">
	<h2 class="text-xl mb-10 font-extrabold mt-6">{$_('me.header')}</h2>
	<div class="grid grid-cols-2 gap-5">
		<p>{$_('me.email')}:</p>
		<p>{userData ? userData.email : ''}</p>

		<p>{$_('me.name')}:</p>
		<p>{userData ? userData.name : ''}</p>

		<p>{$_('me.password')}:</p>
		{#if $page.data.user.passwordSet}
			<a href="/password-reset?email={userData.email}">
				<button class="btn btn-outline btn-sm">{$_('me.resetPassword')}</button>
			</a>
		{:else}
			<div class="flex flex-col">
				<p>{$_('me.passwordNotSet')}
				</p>
				<a href="/password-reset?email={userData.email}">
					<button class="btn btn-outline btn-sm">{$_('me.setPassword')}</button>
				</a>
			</div>
		{/if}
	</div>
	<h3 class="text-lg mb-10 font-extrabold mt-6">{$_('me.connectedAccounts')}</h3>
	<div class="grid grid-cols-2 gap-5 place-content-between">
		<p><Icon data={facebook} scale={1.5} /> Facebook</p>
		{#if $page.data.accounts.facebook}
			<form method="POST" action="?/remove" class="justify-self-end">
				<input type="text" value="facebook" class="hidden" name="provider" />
				<button class="btn btn-outline btn-sm btn-error">{$_('me.removeAccount')}</button>
			</form>
		{:else}
			<div class="justify-self-end">
				<button class="btn btn-outline btn-sm" on:click={() => signIn('facebook')}
					>{$_('me.connectAccount')}</button
				>
			</div>
		{/if}
		<p><Icon data={google} scale={1.5} /> Google</p>
		{#if $page.data.accounts.google}
			<form method="POST" action="?/remove" class="justify-self-end">
				<input type="text" value="google" class="hidden" name="provider" />
				<button class="btn btn-outline btn-sm btn-error">{$_('me.removeAccount')}</button>
			</form>
		{:else}
			<div class="justify-self-end">
				<button class="btn btn-outline btn-sm" on:click={() => signIn('google')}
					>{$_('me.connectAccount')}</button
				>
			</div>
		{/if}
		<p><Icon data={github} scale={1.5} /> GitHub</p>
		{#if $page.data.accounts.github}
			<form method="POST" action="?/remove" class="justify-self-end">
				<input type="text" value="github" class="hidden" name="provider" />
				<button class="btn btn-outline btn-sm btn-error">{$_('me.removeAccount')}</button>
			</form>
		{:else}
			<div class="justify-self-end">
				<button class="btn btn-outline btn-sm" on:click={() => signIn('github')}
					>{$_('me.connectAccount')}</button
				>
			</div>
		{/if}
	</div>

	<div class="mt-10">
		<button class="btn btn-info" on:click={async () => await handleSignOut()}
			>{$_('me.logoutButton')}</button
		>
	</div>
</div>
