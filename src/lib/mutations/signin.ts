import { user as userStore } from '$lib/stores';
import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';

export const signin = async (email: string, password: string) => {
	try {
		const mutation = `
			mutation Signin($email: String!, $password: String!) {
				signin(email: $email, password: $password) {
					email
					id
					name
				}
			}
		`;
		const variables = {
			email,
			password
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
		const { data } = await response.json();
		if (data) {
			userStore.set(data.signin);
			return {
				status: 200,
				body: { user: signin }
			};
		} else {
			return {
				status: 500,
				body: { error: 'signin.error' }
			};
		}
	} catch (error) {
		return {
			status: 500,
			body: { error }
		};
	}
};
