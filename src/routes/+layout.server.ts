import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/auth';

export const load: LayoutServerLoad = async ({
	request,
	locals,
	params,
	cookies,
	url,
	depends
}) => {
	depends('data:session');

	// Language is now stored only in cookies, not in URLs
	// The [lang]/[...rest] compatibility route handles legacy URLs
	const language = cookies.get('language') || 'et'; // Default to Estonian

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
