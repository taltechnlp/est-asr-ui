<script lang="ts">
	import { goto } from '$app/navigation';
	import { userState } from '$lib/stores.svelte';
	import { _ } from 'svelte-i18n';
	import { authClient } from '$lib/auth-client';
	import github from 'svelte-awesome/icons/github';
	import facebook from 'svelte-awesome/icons/facebook';
	import google from 'svelte-awesome/icons/google';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();

	let changeOpened = $state(false);
	const showChange = $derived(changeOpened || (!!form?.change && form.change !== 'sent'));

	const changeErrorText = (code: string) => {
		switch (code) {
			case 'missing': return $_('me.changeMissing');
			case 'invalidEmail': return $_('me.changeInvalidEmail');
			case 'invalidPassword': return $_('me.changeInvalidPassword');
			case 'noPassword': return $_('me.changeNoPassword');
			case 'sameEmail': return $_('me.changeSameEmail');
			case 'emailTaken': return $_('me.changeEmailTaken');
			default: return $_('me.changeError');
		}
	};

	const handleSignOut = async () => {
		try {
			// Clear user state
			userState.email = "";
			userState.id = "";
			userState.name = "";
			
			// Redirect to logout route which will handle session cleanup
			goto('/logout');
		} catch (error) {
			console.error("Sign out error:", error);
		}
	};

	const connectAccount = async (provider: "facebook" | "google") => {
		try {
			await authClient.signIn.social({
				provider: provider,
				callbackURL: "/me"
			});
		} catch (error) {
			console.error("Connect account error:", error);
		}
	};
</script>

<svelte:head>
	<title>{$_('me.title')}</title>
</svelte:head>

<div class="grid w-full min-h-[100dvh] justify-center content-start grid-cols-[minmax(320px,_640px)] ml-1 mr-1 bg-base-100">
	<h2 class="text-xl mb-10 font-extrabold mt-6">{$_('me.header')}</h2>
	<div class="grid grid-cols-2 gap-5">
		<p>{$_('me.email')}:</p>
		<div>
			<p>{data.user.email}</p>
			{#if !data.user.emailVerified}
				<p class="text-warning font-semibold">{$_('me.emailNotVerified')}</p>
				{#if data.user.passwordSet}
					{#if form?.resend === 'sent'}
						<p class="text-green-700">{$_('me.resendSent')}</p>
					{:else if form?.resend === 'error'}
						<p class="text-red-500">{$_('me.resendError')}</p>
					{:else}
						<form method="POST" action="?/resendVerification">
							<button class="btn btn-outline btn-sm mt-1">{$_('me.resendVerification')}</button>
						</form>
					{/if}
				{/if}
			{/if}
		</div>

		<p>{$_('me.name')}:</p>
		<p>{userState.name}</p>

		<p>{$_('me.password')}:</p>
		{#if data.user.passwordSet}
			<a href="/password-reset?email={userState.email}">
				<button class="btn btn-outline btn-sm">{$_('me.resetPassword')}</button>
			</a>
		{:else}
			<div class="flex flex-col">
				<p>{$_('me.passwordNotSet')}
				</p>
				<a href="/password-reset?email={userState.email}">
					<button class="btn btn-outline btn-sm">{$_('me.setPassword')}</button>
				</a>
			</div>
		{/if}
	</div>
	{#if data.user.passwordSet}
		<h3 class="text-lg mb-4 font-extrabold mt-10">{$_('me.changeEmailHeader')}</h3>
		<p class="mb-4">{$_('me.changeEmailIntro')}</p>
		{#if form?.change === 'sent'}
			<p class="text-green-700 font-semibold">{$_('me.changeEmailSent', { values: { email: form.newEmail } })}</p>
		{:else if !showChange}
			<button class="btn btn-outline btn-sm justify-self-start" onclick={() => (changeOpened = true)}>
				{$_('me.changeEmailOpen')}
			</button>
		{:else}
			<form method="POST" action="?/changeEmail" class="grid gap-3">
				{#if form?.change}
					<p class="text-red-500">{changeErrorText(form.change)}</p>
				{/if}
				<label class="form-control">
					<span class="label-text">{$_('me.newEmail')}</span>
					<input class="input input-bordered" type="email" name="newEmail" required value={form?.newEmail ?? ''} />
				</label>
				<label class="form-control">
					<span class="label-text">{$_('me.currentPassword')}</span>
					<input class="input input-bordered" type="password" name="password" required autocomplete="current-password" />
				</label>
				<button class="btn btn-primary btn-sm justify-self-start" type="submit">{$_('me.changeEmailButton')}</button>
			</form>
		{/if}
	{/if}

	<h3 class="text-lg mb-10 font-extrabold mt-10">{$_('me.connectedAccounts')}</h3>
	<div class="grid grid-cols-2 gap-5 place-content-between">
		<p><Icon data={facebook} scale={1.5} /> Facebook</p>
		{#if data.accounts.facebook}
			<form method="POST" action="?/remove" class="justify-self-end">
				<input type="text" value="facebook" class="hidden" name="provider" />
				<button class="btn btn-outline btn-sm btn-error">{$_('me.removeAccount')}</button>
			</form>
		{:else}
			<div class="justify-self-end">
				<button class="btn btn-outline btn-sm" onclick={() => connectAccount('facebook')}
					>{$_('me.connectAccount')}</button
				>
			</div>
		{/if}
		<p><Icon data={google} scale={1.5} /> Google</p>
		{#if data.accounts.google}
			<form method="POST" action="?/remove" class="justify-self-end">
				<input type="text" value="google" class="hidden" name="provider" />
				<button class="btn btn-outline btn-sm btn-error">{$_('me.removeAccount')}</button>
			</form>
		{:else}
			<div class="justify-self-end">
				<button class="btn btn-outline btn-sm" onclick={() => connectAccount('google')}
					>{$_('me.connectAccount')}</button
				>
			</div>
		{/if}
	</div>

	<div class="mt-10">
		<form method="POST" action="?/logout">
			<button class="btn btn-info" type="submit">{$_('me.logoutButton')}</button>
		</form>
	</div>
</div>