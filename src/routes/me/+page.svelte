<script>
	import { goto } from '$app/navigation';
	import { user as userStore } from '$lib/stores';
	import { _ } from 'svelte-i18n';
	let userData;

	userStore.subscribe((value) => {
		userData = value;
	});

	const handleSignOut = async () => {
		try {
			const response = await fetch('/api/signout', {
				method: 'POST',
				body: "",
				headers: {
					'Content-Type': 'application/json'
				}
			});
			userStore.set({ name: '', email: '', id: '' });
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
	</div>
	<div class="mt-10">
		<button class="btn btn-outline" on:click={async () => await handleSignOut()}
			>{$_('me.logoutButton')}</button
		>
	</div>
</div>
