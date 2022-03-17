<script context="module">
	import { user as userStore } from '$lib/stores';
	import { client } from '$lib/graphql-client';
	import { gql } from 'graphql-request';

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
		console.log('Me', me);
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

<p>My name is {userData ? userData.name : 'näeb'}</p>
<p>My name is {user ? user.name : 'näeb'}</p>
