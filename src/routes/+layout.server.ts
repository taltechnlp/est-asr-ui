import type { LayoutServerLoad } from './$types';
import { uiLanguages } from '$lib/i18n';
import { auth } from '$lib/auth';

export const load: LayoutServerLoad = async ({ request, locals, cookies, depends }) => {
	depends('data:session');

	// Detect language from cookie, Accept-Language header, or use default
	let language = cookies.get('language');

	// If no cookie, try to detect from Accept-Language header
	if (!language) {
		const acceptLanguage = request.headers.get('accept-language');
		if (acceptLanguage) {
			// Parse Accept-Language header (e.g., "et-EE,et;q=0.9,en-US;q=0.8,en;q=0.7")
			const languages = acceptLanguage
				.split(',')
				.map(lang => lang.split(';')[0].trim().toLowerCase().substring(0, 2));

			// Find first matching language from our supported languages
			language = languages.find(lang => uiLanguages.includes(lang));
		}
	}

	// Default to Estonian if still no language detected
	if (!language || !uiLanguages.includes(language)) {
		language = 'et';
	}

	// Set the language cookie if not already set or different
	if (cookies.get('language') !== language) {
		cookies.set('language', language, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: true,
		});
	}

	// Get session using the same logic as hooks.server.ts (Better Auth + session cookie)
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
