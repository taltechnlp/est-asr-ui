import type { LayoutServerLoad } from './$types';
import { uiLanguages } from '$lib/i18n';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load: LayoutServerLoad = async ({ request, locals, params, cookies, url, depends }) => {
	depends('data:session');

	// console.log(`[Layout Load] Path: ${url.pathname}, Params: ${JSON.stringify(params)}, Cookie Lang: ${cookies.get("language")}`);

	if (params.lang && uiLanguages.includes(params.lang)) {
		if (cookies.get("language") !== params.lang) {
			// console.log(`[Layout Load] Setting language cookie to: ${params.lang}`);
			cookies.set("language", params.lang, {
				path: "/",
				maxAge: 60 * 60 * 24 * 365,
				httpOnly: true,
			});
		}
	}

	if (!params.lang && cookies.get("language")) {
		const targetLang = cookies.get('language');

		const langPrefix = `/${targetLang}`;
		if (url.pathname === langPrefix || url.pathname.startsWith(langPrefix + '/')) {
			console.warn(`[Layout Load] Potential loop detected! Pathname '${url.pathname}' already seems prefixed with target language '${targetLang}'. Skipping redirect.`);
		} else {
			const targetPath = `${base}${langPrefix}${url.pathname === '/' ? '' : url.pathname}`;
			// console.log(`[Layout Load] Redirecting: Lang missing in URL, cookie is '${targetLang}'. From '${url.pathname}' to '${targetPath}'`);
			redirect(307, targetPath);
		}
	}

	const language = params.lang || cookies.get("language");

	const session = (await locals.auth());

	if (session && session.user) {
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
