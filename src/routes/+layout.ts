import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment'
import type { LayoutLoad, LayoutData } from './$types'

export const load: LayoutLoad = async({ fetch, parent, data }) => {
	if (browser) {
		locale.set(window.navigator.language)
	}
	await waitLocale();
	if (data && data.userId) {
		const response = await fetch('/api/user/' + data.userId, {
			method: 'GET',
		}).catch((e) => {
			console.log("userNotFound", data.userId)
		});
		if (!response) throw error(404, 'userNotFound');
		const { body } = await response.json();
		if (body.user) {
			userStore.set(body.user);
			return body.user;
		} else
			throw error(404, 'userNotFound');

	}
	else return;
}