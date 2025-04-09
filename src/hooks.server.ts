import { handle as authenticationHandle } from "./auth"
import { defaultLang, uiLanguages } from "$lib/i18n";
import { redirect, type Handle, type HandleServerError } from "@sveltejs/kit";
import { AuthError, OAuthAccountNotLinked } from "@auth/core/errors";

async function transformHtml({ event, resolve }) {
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}

const getLang = (event) => {
	const langParam = event.params.lang;
	if (langParam && uiLanguages.includes(langParam)) {
		return langParam;
	}
	const langCookie = event.cookies.get('lang');
	if (langCookie && uiLanguages.includes(langCookie)) {
		return langCookie;
	}
	return defaultLang;
};

export const handle: Handle = async ({ event, resolve }) => {
	const lang = getLang(event);
	const route = event.route.id;
	const pathname = event.url.pathname;

	const currentCookieLang = event.cookies.get('lang');
	if (event.params.lang && uiLanguages.includes(event.params.lang) && event.params.lang !== currentCookieLang) {
		event.cookies.set('lang', event.params.lang, { path: '/', maxAge: 31536000 });
	}

	if (route && !route.startsWith('/[[lang]]') && !pathname.startsWith('/auth/')) {
		const newPathname = `/${lang}${pathname}${event.url.search}`;
		console.log(`[Handle] Language Prefix Redirect: ${pathname} -> ${newPathname}`);
		throw redirect(307, newPathname);
	}

	const resolveWithLangTransform: typeof resolve = (event, opts) => {
		return resolve(event, {
			...opts,
			transformPageChunk: ({ html }) => html.replace('%lang%', lang)
		});
	};

	try {
		const response = await authenticationHandle({ 
			event, 
			resolve: resolveWithLangTransform 
		});
		return response;
	} catch (error) {
		console.log("[Handle Catch] Caught an error (potentially OAuth related).");
		console.log("[Handle Catch] Error object:", error);

		if (error instanceof AuthError && error.type === OAuthAccountNotLinked.type) {
			const errorType = error.type;
			const signInUrl = `/${lang}/signin?error=${errorType}`;
			console.log(`[Handle] Caught ${errorType}. Redirecting to: ${signInUrl}`);
			throw redirect(303, signInUrl);
		}

		console.log(`[Handle Catch] Error not OAuthAccountNotLinked, re-throwing.`);
		throw error;
	}
};

export const handleError: HandleServerError = ({ error, event }) => {
	console.error("Server Error:", error, "Event:", event);
	return {
		message: 'An unexpected error occurred.',
		...(import.meta.env.DEV ? { errorDetails: error?.toString() } : {})
	};
};