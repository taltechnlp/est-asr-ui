import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';
import { goto } from '$app/navigation';
import { user as userStore } from '$lib/stores';

export const signOutMutation = `
    mutation SIGN_OUT_MUTATION {
        signout {
            message
        }
    }
`;

export const signOut = async () => {
	try {
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query: signOutMutation
			})
		});
		const { data } = await response.json();
		userStore.set({ name: '', email: '', id: '' });
		await goto('/');
	} catch (error) {
		return {
			status: 500,
			body: { error }
		};
	}
};
