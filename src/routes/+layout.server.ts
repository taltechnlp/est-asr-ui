import type { LayoutServerLoad } from './$types';
import { uiLanguages, defaultLang } from '$lib/i18n';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load: LayoutServerLoad = async ({ request, locals, params, cookies, url, depends }) => {
	depends('data:session');

	console.log(`[Layout Load] Path: ${url.pathname}, Search: ${url.search}, Params: ${JSON.stringify(params)}, Cookie Lang: ${cookies.get("lang")}`);

	if (params.lang && uiLanguages.includes(params.lang)) {
		if (cookies.get("lang") !== params.lang) {
			// console.log(`[Layout Load] Setting language cookie to: ${params.lang}`);
			cookies.set("lang", params.lang, {
				path: "/",
				maxAge: 60 * 60 * 24 * 365,
				httpOnly: false,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax'
			});
		}
	}

	if (!params.lang && cookies.get("lang")) {
		const targetLang = cookies.get('lang');

		const langPrefix = `/${targetLang}`;
		if (url.pathname === langPrefix || url.pathname.startsWith(langPrefix + '/')) {
			console.warn(`[Layout Load] Pathname '${url.pathname}' already seems prefixed with target language '${targetLang}'. Skipping redirect.`);
		} else {
			const targetPath = `${base}${langPrefix}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
			console.log(`[Layout Load] Redirecting: Lang missing in URL, cookie is '${targetLang}'. From '${url.pathname}${url.search}' to '${targetPath}'`);
			redirect(307, targetPath);
		}
	}

	const language = params.lang || cookies.get("lang") || defaultLang;

	const session = await locals.auth();

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
