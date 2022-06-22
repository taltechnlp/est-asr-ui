import { user as userStore } from '$lib/stores';
import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';

export const pwReset = async (email: string) => {
	try {
		const mutation = `
			mutation REQUEST_RESET_MUTATION($email: String!) {
				requestReset(email: $email) {
                    message
                }
			}
		`;
		const variables = {
			email
		};
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query: mutation,
				variables
			})
		});
		const res = await response.json();
		if (res) {
			return {
				status: 200,
			};
		} else {
			return {
				status: 500,
				body: { error: 'reset.error' }
			};
		}
	} catch (error) {
		return {
			status: 500,
			body: { error }
		};
	}
};
