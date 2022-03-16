import { client } from '$lib/graphql-client';
import { gql } from 'graphql-request';

export const get = async () => {
	try {
		const query = gql`
			query FILES_BY_USER($userId: ID!) {
				filesByUser(userId: $userId) {
					id
					filename
					duration
					uploadedAt
					textTitle
					state
				}
			}
		`;

		console.log('files get päring');
		const files = await client.request(query);
		console.log('tulemus', files);
		return {
			status: 200,
			body: { files }
		};
	} catch (error) {
		return {
			status: 500,
			body: { error: 'There was a server error.' }
		};
	}
};
