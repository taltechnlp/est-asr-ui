import { SECRET_KEY } from '$env/static/private';
import { SvelteKitAuth } from "@auth/sveltekit"
// import GitHub from '@auth/core/providers/github';
import Facebook from '@auth/core/providers/facebook';
import Google from '@auth/core/providers/google';
import Credentials from "@auth/sveltekit/providers/credentials"
// import EmailProvider from "@auth/core/providers/email"
import { /* GITHUB_ID, GITHUB_SECRET, */ EST_ASR_URL, AUTH_SECRET, FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "$env/static/private";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "$lib/db/client";
import bcrypt from 'bcrypt';
import type {SvelteKitAuthConfig} from '@auth/sveltekit'

let userId = undefined;
let isSignInFlow = false;

// URL will contain `error=CredentialsSignin&code=custom_error`

export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
	const authOptions = {
		// @ts-ignore
		adapter: PrismaAdapter(prisma),
		jwt: {
			secret: SECRET_KEY,
			maxAge: 15 * 24 * 30 * 60, // 15 days
		},
		providers: [
			/* GitHub({ clientId: GITHUB_ID, clientSecret: GITHUB_SECRET }),
			// @ts-ignore */
			Facebook({
				clientId: FACEBOOK_CLIENT_ID,
				clientSecret: FACEBOOK_CLIENT_SECRET,
			}),
			Google({
				clientId: GOOGLE_CLIENT_ID,
				clientSecret: GOOGLE_CLIENT_SECRET,
			}),
			Credentials({
				// You can specify which fields should be submitted, by adding keys to the `credentials` object.
				// e.g. domain, username, password, 2FA token, etc.
				credentials: {
				  email: {},
				  password: {},
				},
				authorize: async (credentials) => {
					let user = null;
					if (
						typeof credentials.email === 'string' &&
    					typeof credentials.password === 'string'
					) {
						user = await prisma.user.findUnique({
							where: {
								email: credentials.email
							},
							select: {
								email: true,
								password: true,
								id: true,
								emailVerified: true,
                                name: true
							}
						});
					};
                    console.log("credentials:", credentials, "user:", user);
					if (!user) {
					  // No user found, so this is their first attempt to login
					  // Optionally, this is also the place you could do a user registration
					  throw new Error("Invalid credentials.")
					};
					const valid = await bcrypt.compare(credentials.password, user.password);
					if (!valid) {
						throw new Error("Invalid credentials.")
					};
					// const token = jwt.sign({ userId: user.id }, SECRET_KEY);
		   
				  // return JSON object with the user data
				  return {
					email: user.email,
					id: user.id,
                    name: user.name
				  }
				},
			}),
			/* EmailProvider({
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
				}), */
			],
			secret: AUTH_SECRET,
		trustHost: true,
		pages: {
			signIn: "/signin",
			error: '/signin/error', // Error code passed in query string as ?error=
			verifyRequest: '/auth/verify-request', // (used for check email message)
			newUser: '/files' // New users will be directed here on first sign in (leave the property out if not of interest)
		},
		events: {
			signIn: (x) => console.log("signin", x),
			signOut: (x) => console.log("signout", x), 
		}, 
		callbacks: {
			async jwt({ token, user, trigger, isNewUser }) {
				if (trigger === 'signIn') console.log("Signing in", trigger, "is new user", isNewUser, user)
				else if (trigger === 'signUp') console.log("Signing up", trigger, "is new user", isNewUser, user)
				if (user) {
					token.id = user.id;
					token.email = user.email;
					token.name = user.name;
					token.picture = user.image;
				}
				return token;
			},
			async redirect({ url, baseUrl }) {
				console.log("redirect cb", url, baseUrl)
				// Allows relative callback URLs
				if (url.startsWith("/")) return `${EST_ASR_URL}${url}`
			 
				// Allows callback URLs on the same origin
				if (new URL(url).origin === EST_ASR_URL) return url
			 
				return baseUrl
			},
			async session({ session, token, user, newSession, trigger }) {
				console.log("session test", newSession, trigger);
				if (token) {
					session.user = token;
				}
				session.user.id = user.id;
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
				console.log(user, account, credentials, email, profile);
				// Allow all password / 2FA requests to pass. 
				if (account.provider === "credentials") return true;
				else if (isSignInFlow || !existingAccount) {
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
		} 
	}
	return authOptions satisfies SvelteKitAuthConfig
});
