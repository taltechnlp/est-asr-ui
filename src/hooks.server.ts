import type { Handle } from '@sveltejs/kit';
import { sequence } from "@sveltejs/kit/hooks";
import { auth } from "$lib/auth";

// Create Better Auth handle that also provides locals.auth() compatibility
const authHandle: Handle = async ({ event, resolve }) => {
	// Add auth function to locals for compatibility with existing code
	// @ts-ignore - Temporary ignore for session type compatibility
	event.locals.auth = async () => {
		try {
			const betterAuthSession = await auth.api.getSession({
				headers: event.request.headers
			});
			
			// If no session, return null
			if (!betterAuthSession) {
				return null;
			}
			
			// Map Better Auth session to AuthJS Session format
			return {
				user: {
					...betterAuthSession.user,
					userId: betterAuthSession.user.id // Add userId for compatibility
				},
				expires: betterAuthSession.session.expiresAt.toISOString()
			};
		} catch (error) {
			console.error('Auth session error:', error);
			return null;
		}
	};
	
	return resolve(event);
};

async function transformHtml({ event, resolve }) {
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}

export const handle: Handle = sequence(authHandle, transformHtml);