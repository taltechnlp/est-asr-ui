import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';

export async function preload() {
	return waitLocale();
}

export async function load({ fetch, parent, data }) {
	if (data && data.userId) {
		const response = await fetch('/api/user/' + data.userId, {
			method: 'GET',
		}).catch((e) => {
			return {
				status: 404,
				error: 'userNotFound'
			};
		});
		const { body } = await response.json();
		if (body.user) {
			userStore.set(body.user);
			return body.user;
		} else
			throw error(404, 'userNotFound');

	}
	else return;
}