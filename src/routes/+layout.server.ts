import { locale } from 'svelte-i18n';
import type { LayoutServerLoad } from './$types';
import type { Sess } from '../types';
import { uiLanguages } from '$lib/i18n';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ request, locals, params, cookies, url }) => {
	if (params.lang && uiLanguages.includes(params.lang)) {
		if (!cookies.get("language") || cookies.get("language") !== params.lang) {
			cookies.set("language", params.lang, {
				path: "/"
			})
			console.log("Just set langugage to", params.lang)
		}
	}
	if (!params.lang && cookies.get("language")) {
		throw redirect(301, '/' + cookies.get('language') + url.pathname);
	}
	const language = params.lang || cookies.get("language");
	const session = (await locals.getSession()) as Sess;
	if (locals.userId) {
		return {
			id: locals.userId,
			language
		};
	} else if (session && session.user) {
		return {
			id: session.user.id,
			language
		};
	} else {
		return {
			language
		};
	}
};
