import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';
import '$lib/i18n'; // Import to initialize
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, parent, data }) => {
	await waitLocale();
	if (data && data.user) {
		userStore.set({
			id: data.user.id || "", 
			email: data.user.email || "", 
			name: data.user.name || ""
		});
	} 
	return { language: data.language };
};
