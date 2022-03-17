import { client } from '$lib/graphql-client';
import { gql } from 'graphql-request';
import { user as userStore } from '$lib/stores';

export const signin = async (email: string, password: string) => {
	try {
		const mutation = gql`
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
		const { signin } = await client.request(mutation, variables);
		userStore.set(signin);
		return {
			status: 200,
			body: { user: signin }
		};
	} catch (error) {
		return {
			status: 500,
			body: { error }
		};
	}
};
