<script context="module">
	import { user as userStore } from '$lib/stores';
	import { client } from '$lib/graphql-client';
	import { gql } from 'graphql-request';
	import { signOut } from '$lib/mutations/signout';
	import { _ } from 'svelte-i18n';

	export async function load({ params, fetch, session, stuff }) {
		const query = gql`
			query {
				me {
					id
					email
					name
				}
			}
		`;
		const { me } = await client.request(query);
		userStore.set(me);

		return {
			status: 200,
			props: {
				user: me
			}
		};
	}
</script>

<script>
	export let user;
	let userData;

	userStore.subscribe((value) => {
		userData = value;
	});
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
		<button class="btn btn-outline" on:click={async () => await signOut()}
			>{$_('me.logoutButton')}</button
		>
	</div>
</div>
