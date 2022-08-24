import { user as userStore } from '$lib/stores';
import { client } from '$lib/graphql-client';
import { gql } from 'graphql-request';
import { _ } from 'svelte-i18n';

throw new Error("@migration task: Migrate the load function input (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
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
		user: me
	};
}
