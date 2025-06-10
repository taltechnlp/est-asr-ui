import type { Handle } from '@sveltejs/kit';
import { sequence } from "@sveltejs/kit/hooks";
import { auth } from "$lib/auth";
import { prisma } from "$lib/db/client";
import { SESSION_COOKIE, readSessionToken } from "$lib/server/session";

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
			
			// If no Better Auth session, check for our signed session cookie
			const sessionCookie = event.cookies.get(SESSION_COOKIE);

			if (sessionCookie) {
				const session = readSessionToken(sessionCookie);
				const user = session && await prisma.user.findUnique({
					where: { id: session.userId },
					select: { id: true, email: true, name: true }
				});

				if (!session || !user) {
					// Not signed by us, expired, or the user is gone: remove the cookie
					event.cookies.delete(SESSION_COOKIE, { path: '/' });
					return null;
				}

				return {
					user: {
						id: user.id,
						email: user.email,
						name: user.name,
						userId: user.id // Add userId for compatibility
					},
					expires: session.expires.toISOString()
				};
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