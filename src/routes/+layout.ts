import { userState } from '$lib/stores.svelte';
import { waitLocale } from 'svelte-i18n';
import '$lib/i18n'; // Import to initialize
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, parent, data }) => {
	await waitLocale();
	if (data && data.user) {
		userState.id = data.user.id || ""; 
		userState.email = data.user.email || "";
		userState.name = data.user.name || "";
	}
	return { language: data.language };
};
