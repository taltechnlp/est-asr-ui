import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';
import '$lib/i18n'; // Import to initialize
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, parent, data }) => {
	await waitLocale();
	if (data && data.id) {
		const response = await fetch('/api/user/' + data.id, {
			method: 'GET'
		}).catch((e) => {
			console.log('userNotFound', data.id);
		});
		if (!response) throw redirect(307, '/signin');
		const { body } = await response.json();
		if (body.user) {
			userStore.set(body.user);
			return body.user;
		} else throw redirect(307, '/signin');
	} else return;
};
