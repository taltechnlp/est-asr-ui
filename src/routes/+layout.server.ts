import { locale } from 'svelte-i18n';
import type { LayoutServerLoad } from './$types';
import type { Sess } from '../types';
import { uiLanguages } from '$lib/i18n';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db/client';

export const load: LayoutServerLoad = async ({ request, locals, params, cookies, url }) => {
	if (params.lang && uiLanguages.includes(params.lang)) {
		if (!cookies.get("language") || cookies.get("language") !== params.lang) {
			cookies.set("language", params.lang, {
				path: "/"
			})
		}
	}
	if (!params.lang && cookies.get("language")) {
		redirect(301, '/' + cookies.get('language') + url.pathname);
	}
	const language = params.lang || cookies.get("language");
	const session = (await locals.getSession()) as Sess;
	if (locals.userId) {
		const user = await prisma.user.findUnique({
			where: {
				id: locals.userId
			},
			select: {
				id: true,
				name: true,
				email: true,
			}
		});
		return {
			user,
			language
		};
	} else if (session && session.user) {
		return {
			user: session.user,
			language
		};
	} else {
		return {
			language
		};
	}
};
