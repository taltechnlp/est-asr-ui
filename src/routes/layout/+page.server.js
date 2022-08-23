import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';

export async function preload() {
	return waitLocale();
}

throw new Error("@migration task: Migrate the load function input (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292693)");
export async function load({ params, fetch, session, stuff }) {
	if (session.userId) {
		const response = await fetch('/api/user/' + session.userId, {
			method: 'GET',
			/* body: JSON.stringify({ userId: session.userId }), */
			/* headers: {
				'Content-Type': 'application/json'
			} */
		}).catch((e) => {
			return {
				status: 404,
				error: 'userNotFound'
			};
		});
		const { user } = await response.json();
		if (user) {
			userStore.set(user);
			return ;
		} else
			throw error(404, 'userNotFound');
	} else {
		return ;
	}
}
