import { client } from '$lib/graphql-client';
import { gql } from 'graphql-request';

export const get = async () => {
	try {
		const query = gql`
			query {
				me {
					id
					email
					name
				}
			}
		`;

		const me = await client.request(query);
		console.log('me objekt', me);

		return {
			status: 200,
			body: { me }
		};
	} catch (error) {
		return {
			status: 500,
			body: { error: 'There was a server error.' }
		};
	}
};
