import { parse } from 'cookie';
import jwt from 'jsonwebtoken'
import type { Handle } from '@sveltejs/kit';
import { SECRET_KEY } from '$env/static/private';
import { SvelteKitAuth } from "@auth/sveltekit"
import GitHub from '@auth/core/providers/github';
import Facebook from '@auth/core/providers/facebook';
import Google from '@auth/core/providers/google';
import { GITHUB_ID, GITHUB_SECRET, AUTH_SECRET, FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "$env/static/private";
import { sequence } from "@sveltejs/kit/hooks";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "$lib/db/client";
import { serialize } from 'cookie';

const checkPath = (event) => {
	return !event.url.pathname.startsWith('/demo') && !event.url.pathname.startsWith('/files/');
};

let userId;
async function authorization({ event, resolve }) {
	const cookie = await parse(event.request.headers.get('cookie') || '');
	if (cookie.token) {
		const userDetails = jwt.verify(cookie.token, SECRET_KEY);
		if (userDetails.userId) {
			event.locals.userId = userDetails.userId
			userId = userDetails.userId;
		}
	}
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}
export const handle: Handle =
	sequence(authorization, SvelteKitAuth({
		// TODO! When the auth library is ready for production, let the PrismaAdapter persist to DB.
		// Right now it's not possible to create custom pages for merging accounts etc.
		// @ts-ignore
		// adapter: PrismaAdapter(prisma),
		providers: [
			GitHub({ clientId: GITHUB_ID, clientSecret: GITHUB_SECRET }),
			// @ts-ignore
			Facebook({
				clientId: FACEBOOK_CLIENT_ID,
				clientSecret: FACEBOOK_CLIENT_SECRET,
			}),
			Google({
				clientId: GOOGLE_CLIENT_ID,
				clientSecret: GOOGLE_CLIENT_SECRET,
			}),],
		secret: AUTH_SECRET,
		trustHost: true,
		pages: {
			signIn: "/signin",
			error: '/signup/error', // Error code passed in query string as ?error=
    		verifyRequest: '/auth/verify-request', // (used for check email message)
    		newUser: '/signup/new-user' // New users will be directed here on first sign in (leave the property out if not of interest)
		}, 
		events: {
					signIn: (x) => console.log(x),
					signOut: (x) => console.log(x),
				},
		callbacks: {
			// @ts-ignore
			signIn: async ({ user, account, credentials, email, profile})=>{
				console.log("signin")
				const existingAccount = await prisma.account.findFirst({
					where: {
						providerAccountId: account.providerAccountId
					},
					include: {
						user: {
							select: {
								email: true,
								id: true,
							}
						}
					}
				})
				// Logged in, /me page
				if (userId) {
					// No such login method yet
					if (!existingAccount) {
						let failed = false;
						const res = await prisma.account.create({
							data: {
								provider: account.provider, 
								providerAccountId: account.providerAccountId,
								type: account.type,
								access_token: account.access_token,
								expires_at: account.expires_in,
								id_token: account.id_token,
								refresh_token: account.refresh_token,
								scope: account.scope,
								token_type: account.token_type,
								user: {
									connect: {
										id: userId
									}
								}
							}
						}).catch(e => failed = true)
						if (failed) {
							console.log("Unexpected account creation error", userId, account.provider, account.providerAccountId)
							return `/me?error=accountAddingFailed`;}
						else return true;
					} 
					// Logged in user does not have this auth method/account and it belongs to someone else.
					else if (existingAccount && existingAccount.userId !== userId) {
						return `/me?error=accountBelongsToAnother`;
					}
					else {
						return true;
					}
				}
				// Not currently logged in, log in or registration flow
				else {
					if (existingAccount) {
					// log in
						return true;
					}
					else {
					// registration flow should first create a user and then add this accoun/login method.
						return '/signin/complete';
					}
				}
			},
			async redirect({ url, baseUrl }) {
				console.log("redirect", url, baseUrl)
				// Allows relative callback URLs
				if (url.startsWith("/")) return `${baseUrl}${url}`
				// Allows callback URLs on the same origin
				else if (new URL(url).origin === baseUrl) return url
				return baseUrl
			}
			/**
			 * The session callback is called whenever a session is checked. By default, only a subset of the token is
			 * returned for increased security. We are sending properties required for the client side to work.
			 * 
			 * @param session - Session object
			 * @param token - Decrypted JWT that we returned in the jwt callback
			 * @returns - Promise with the result of the session
			 */
			/*
			async session(parameters) {
				const { session, token } = parameters;
				session.user = token.user
				session.accessToken = token.accessToken
				session.error = token.error
				console.log(parameters)
				return session;
			},*/
		}, 
	}));