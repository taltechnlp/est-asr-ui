import { client } from '$lib/graphql-client';
import { gql } from 'graphql-request';

export const signup = async (email: string, password: string, name: string) => {
	try {
		const mutation = gql`
			mutation Signup($email: String!, $password: String!, $name: String!) {
				signup(email: $email, password: $password, name: $name) {
					id
					email
					name
				}
			}
		`;
		const variables = {
			email,
			password,
			name
		};
		const res = await client.request(mutation, variables);
		return {
			status: 200,
			body: res
		};
	} catch (error) {
		return {
			status: 500,
			body: { error: 'There was a server error.' }
		};
	}
};
