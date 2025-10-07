import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uiLanguages } from '$lib/i18n';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { language } = await request.json();

		// Validate that the language is supported
		if (!language || !uiLanguages.includes(language)) {
			return json(
				{ error: 'Invalid language' },
				{ status: 400 }
			);
		}

		// Set the language cookie
		cookies.set('language', language, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			httpOnly: true,
			sameSite: 'strict',
		});

		console.log(`[Language API] Language cookie set to: ${language}`);

		return json({ success: true, language });
	} catch (error) {
		console.error('[Language API] Error setting language:', error);
		return json(
			{ error: 'Failed to set language' },
			{ status: 500 }
		);
	}
};
