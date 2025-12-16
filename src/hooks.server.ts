import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from "@sveltejs/kit/hooks";
import { redirect } from '@sveltejs/kit';
import { auth } from "$lib/auth";
import { prisma } from "$lib/db/client";

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
						// Validate user exists in database
						const user = await prisma.user.findUnique({
							where: { id: sessionData.userId },
							select: { id: true, email: true, name: true }
						});

						if (!user) {
							// User doesn't exist, remove invalid cookie
							event.cookies.delete('session', { path: '/' });
							return null;
						}

						return {
							user: {
								id: user.id,
								email: user.email,
								name: user.name,
								userId: user.id // Add userId for compatibility
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

	try {
		const response = await resolve(event);

		// Check if the response is a 401 and redirect to login
		if (response.status === 401) {
			// Get the current path to redirect back after login
			const redirectTo = event.url.pathname + event.url.search;
			const loginUrl = `/signin?redirect=${encodeURIComponent(redirectTo)}`;
			throw redirect(302, loginUrl);
		}

		return response;
	} catch (error) {
		// If it's already a redirect, rethrow it
		if (error?.status && error?.location) {
			throw error;
		}
		throw error;
	}
};

async function transformHtml({ event, resolve }) {
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}

export const handle: Handle = sequence(authHandle, transformHtml);