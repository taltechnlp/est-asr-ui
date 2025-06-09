import type { Handle } from '@sveltejs/kit';
import { sequence } from "@sveltejs/kit/hooks";
import { auth } from "$lib/auth";

// Create Better Auth handle
const authHandle: Handle = async ({ event, resolve }) => {
	// Get session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers
	});
	
	// Add auth function to locals for compatibility
	// @ts-ignore - Temporary ignore for migration
	event.locals.auth = async () => session;
	
	return resolve(event);
};

async function transformHtml({ event, resolve }) {
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}

export const handle: Handle = sequence(authHandle, transformHtml);