import { client } from '$lib/graphql-client';
import { gql } from 'graphql-request';

export const resetPassword  = async ( password: string, resetToken: string) => {
	const confirmPassword = password;
	try {
		const mutation = gql`
		mutation RESET_MUTATION(
			$resetToken: String!
			$password: String!
			$confirmPassword: String!
		  ) {
			resetPassword(
			  resetToken: $resetToken
			  password: $password
			  confirmPassword: $confirmPassword
			) {
			  id
			  email
			  name
			}
		  }
		`;
		const variables = {
			resetToken,
			password,
			confirmPassword
		};
		const res = await client.request(mutation, variables);
		return {
			status: 200,
			body: res
		};
	} catch (error) {
		console.log(error)
		return {
			status: 500,
			body: { error: error }
		};
	}
};
