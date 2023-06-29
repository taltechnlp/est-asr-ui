import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad, LayoutData } from './$types';

export const load: LayoutLoad = async ({ fetch, parent, data }) => {
	if (browser) {
		locale.set(window.navigator.language);
	}
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
