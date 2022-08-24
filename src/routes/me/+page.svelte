<script context="module">
	throw new Error("@migration task: Check code was safely removed (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292722)");

	// import { user as userStore } from '$lib/stores';
	// import { client } from '$lib/graphql-client';
	// import { gql } from 'graphql-request';
	// import { _ } from 'svelte-i18n';

	// export async function load({ params, fetch, session, stuff }) {
	// 	const query = gql`
	// 		query {
	// 			me {
	// 				id
	// 				email
	// 				name
	// 			}
	// 		}
	// 	`;
	// 	const { me } = await client.request(query);
	// 	userStore.set(me);

	// 	return {
	// 		status: 200,
	// 		props: {
	// 			user: me
	// 		}
	// 	};
	// }
</script>

<script>
	throw new Error("@migration task: Add data prop (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292707)");

	import { goto } from '$app/navigation';
	export let user;
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
