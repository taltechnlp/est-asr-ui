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
		console.log(params, session, stuff);
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
	import { user as userData } from '$lib/stores';

	export let user;
	let myData;

	userData.subscribe((value) => {
		myData = value;
	});
</script>

<p>My name is {myData ? myData.name : 'näeb'}</p>
<p>My name is {user ? user.name : 'näeb'}</p>
