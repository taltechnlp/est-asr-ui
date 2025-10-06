import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { uiLanguages } from '$lib/i18n';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const lang = params.lang;
	const rest = params.rest || '';

	// Check if the language is valid
	if (lang && uiLanguages.includes(lang)) {
		// Set the language cookie
		cookies.set('language', lang, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: true,
		});

		// Build the redirect path without the language prefix
		const redirectPath = rest ? `/${rest}` : '/';

		// Preserve query parameters
		const searchParams = url.searchParams.toString();
		const finalPath = searchParams ? `${redirectPath}?${searchParams}` : redirectPath;

		console.log(`[Compatibility Redirect] Redirecting from /${lang}/${rest} to ${finalPath}`);

		// Redirect to the path without language
		throw redirect(302, finalPath);
	}

	// If the language is not valid, redirect to home
	throw redirect(302, '/');
};
