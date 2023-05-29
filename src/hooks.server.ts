import { parse } from 'cookie';
import jwt from 'jsonwebtoken'
import type { Handle } from '@sveltejs/kit';
import { SECRET_KEY } from '$env/static/private';
import { SvelteKitAuth } from "@auth/sveltekit"
import GitHub from '@auth/core/providers/github';
import Facebook from '@auth/core/providers/facebook';
import Google from '@auth/core/providers/google';
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email"
import { GITHUB_ID, GITHUB_SECRET, AUTH_SECRET, FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL } from "$env/static/private";
import { SECRET_MAIL_HOST, SECRET_MAIL_PORT, SECRET_MAIL_USER, SECRET_MAIL_PASS, SECRET_MAIL_FROM } from "$env/static/private";
import { sequence } from "@sveltejs/kit/hooks";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "$lib/db/client";
import { redirect } from "@sveltejs/kit";
import { error } from '@sveltejs/kit';

let userId;
async function pwdAuthorization({ event, resolve }) {
	const token = event.cookies.get('token');
	if (token) {
		const userDetails = jwt.verify(token, SECRET_KEY);
		if (userDetails.userId) {
			event.locals.userId = userDetails.userId
			userId = userDetails.userId;
		}
	}
	return resolve(event);
}
async function transformHtml({ event, resolve }) {
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}
export const handle: Handle =
	sequence(pwdAuthorization, SvelteKitAuth({
		// @ts-ignore
		adapter: PrismaAdapter(prisma),
		jwt: {
			secret: SECRET_KEY,
			maxAge: 15 * 24 * 30 * 60, // 15 days
		},
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
			}),
			EmailProvider({
				server: {
					host: SECRET_MAIL_HOST,
					port: SECRET_MAIL_PORT,
					auth: {
						user: SECRET_MAIL_USER,
						pass: SECRET_MAIL_PASS
					}
				},
				from: SECRET_MAIL_FROM
				// maxAge: 24 * 60 * 60, // How long email links are valid for (default 24h)
			}),
			CredentialsProvider({
				// The name to display on the sign in form (e.g. 'Sign in with...')
				name: 'password',
				// The credentials is used to generate a suitable form on the sign in page.
				// You can specify whatever fields you are expecting to be submitted.
				// e.g. domain, username, password, 2FA token, etc.
				// You can pass any HTML attribute to the <input> tag through the object.
				credentials: {
					/* email: {
						label: "Email",
						type: "email",
						placeholder: "jsmith@gmail.com",
					},
					password: { label: "Password", type: "password" }, */
				},
				async authorize(credentials, req) {
					// You need to provide your own logic here that takes the credentials
					// submitted and returns either a object representing a user or value
					// that is false/null if the credentials are invalid.
					// e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
					// You can also use the `req` object to obtain additional parameters
					// (i.e., the request IP address)
					if (userId) {
						const user = await prisma.user.findUnique({
							where: {
								id: userId
							},
							select: {
								email: true,
								id: true,
								name: true,
								role: true,
								image: true,
							}
						})
						return user;
					}
					else return null
				}
			})
		],
		secret: AUTH_SECRET,
		trustHost: true,
		pages: {
			signIn: "/signin",
			error: '/signin/error', // Error code passed in query string as ?error=
			verifyRequest: '/auth/verify-request', // (used for check email message)
			newUser: '/files' // New users will be directed here on first sign in (leave the property out if not of interest)
		},
		/* events: {
			signIn: (x) => console.log(x),
			signOut: (x) => console.log(x),
		}, */
		callbacks: {
			async jwt({ token, user }) {
				if (user) {
					token.id = user.id;
					token.email = user.email;
					token.name = user.name;
					token.picture = user.image;
				}
				return token;
			},
			async session({ session, token, user }) {
				if (token) {
					session.user = token;
				}
				return session;
			},
			signIn: async ({ user, account, credentials, email, profile }) => {
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
				});
				// Allow all password / 2FA requests to pass. 
				if (account.provider === "credentials") return true;
				else if (!userId || !existingAccount) {
					if (!existingAccount) {
						const emailUsed = await prisma.user.findUnique({
							where: {
								email: user.email
							},
							select: {
								id: true,
								email: true
							}
						})
						if (emailUsed && userId && emailUsed.id === userId) {
							// Manually add the login method
							const addAccount = await prisma.account.create({
								data: {
									provider: account.provider,
									providerAccountId: account.providerAccountId,
									type: account.type,
									access_token: account.access_token,
									expires_in: account.expires_in,
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
							})
							if (addAccount) return true;
							else return false;
						}
						// SvelteKit auth handles the case where there is a session already and account can be linked.
					}
					// Returns AccountNotLinked if not logged in and belongs to some other user.
					return true;
				}
				else {
					// Auth.js does not handle this case that another user has the OAUTH account and they are logged in with password.
					if (existingAccount.userId !== userId || user.id !== userId) {
						return false;
					}
					else {
						return true;
					}
				}
			},
			/* async redirect({ url, baseUrl }) {
				console.log("redirect", url, baseUrl)
				// Allows relative callback URLs
				if (url.startsWith("/")) return `${baseUrl}${url}`
				// Allows callback URLs on the same origin
				else if (new URL(url).origin === baseUrl) return url
				return baseUrl
			} */
		},
	}), transformHtml);