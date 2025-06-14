import type { Handle } from '@sveltejs/kit';
import { sequence } from "@sveltejs/kit/hooks";
import { auth } from "$lib/auth";

// Create Better Auth handle that also provides locals.auth() compatibility
const authHandle: Handle = async ({ event, resolve }) => {
	// Add auth function to locals for compatibility with existing code
	// @ts-ignore - Temporary ignore for session type compatibility
	event.locals.auth = async () => {
		try {
			// First, try Better Auth session
			const betterAuthSession = await auth.api.getSession({
				headers: event.request.headers
			});
			
			// If Better Auth has a session, use it
			if (betterAuthSession) {
				return {
					user: {
						...betterAuthSession.user,
						userId: betterAuthSession.user.id // Add userId for compatibility
					},
					expires: betterAuthSession.session.expiresAt.toISOString()
				};
			}
			
			// If no Better Auth session, check for our simple session cookie
			const sessionCookie = event.cookies.get('session');
			
			if (sessionCookie) {
				try {
					const sessionData = JSON.parse(sessionCookie);
					
					// Validate that it has the expected structure and is logged in
					if (sessionData.loggedIn && sessionData.userId && sessionData.email) {
						return {
							user: {
								id: sessionData.userId,
								email: sessionData.email,
								name: sessionData.name,
								userId: sessionData.userId // Add userId for compatibility
							},
							expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
						};
					}
				} catch (error) {
					console.error('[HOOKS] Error parsing session cookie:', error);
					// Invalid cookie, remove it
					event.cookies.delete('session', { path: '/' });
				}
			}
			
			// No valid session found
			return null;
		} catch (error) {
			console.error('[HOOKS] Auth session error:', error);
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