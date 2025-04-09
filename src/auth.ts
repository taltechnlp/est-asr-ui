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
import { AuthError, CredentialsSignin } from '@auth/core/errors'
import { type DefaultSession } from "@auth/sveltekit"
import { uiLanguages, defaultLang } from '$lib/i18n'; // Import your list of languages and default language
// No longer need URL if redirect callback is removed
// import { URL } from 'url'; // Make sure URL is available (usually is in Node env)

declare module "@auth/sveltekit" {
  interface Session {
    user: {
      userId: string
      /**
       * By default, TypeScript merges new interface properties and overwrites existing ones.
       * In this case, the default session user properties will be overwritten,
       * with the new ones defined above. To keep the default session user properties,
       * you need to add them back into the newly declared interface.
       */
    } & DefaultSession["user"]
  }
}

// URL will contain `error=CredentialsSignin&code=custom_error`

export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
	// Determine language for potential use in other callbacks if needed
	const langForCallback = event.params.lang || event.cookies.get('lang') || defaultLang;
	// console.log("SvelteKitAuth handler: Determined lang for callbacks:", langForCallback);

	const authOptions = {
		adapter: PrismaAdapter(prisma),
		providers: [
			/* GitHub({ clientId: GITHUB_ID, clientSecret: GITHUB_SECRET }),*/
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
                    // ("credentials:", credentials, "user:", user);
					if (!user) {
					  // No user found, so this is their first attempt to login
					  // Optionally, this is also the place you could do a user registration
					  
					  console.log("registration case")
					  class EmailError extends CredentialsSignin {
						code = "emailError"
					   }
					   // URL will contain `error=CredentialsSignin&code=custom_error`
					throw new EmailError( "user does not exist");
					};
					const valid = await bcrypt.compare(credentials.password, user.password);
					if (!valid) {
						class PasswordError extends CredentialsSignin {
							code = "passwordError"
						   }
						   // URL will contain `error=CredentialsSignin&code=custom_error`
						throw new PasswordError("wrong password");
					};
					// const token = jwt.sign({ userId: user.id }, SECRET_KEY);
		   
				  // return JSON object with the user data
				  return {
					email: user.email,
					id: user.id,
                    name: user.name,
					picture: ""
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
		session: {
			maxAge: 2592000,
			updateAge: 60,
			strategy: "jwt", // "jwt" | "database"
		},
		pages: {
			signIn: "/et/signin",
			// error: '/signin', // Keep this commented out/removed
			verifyRequest: '/et/auth/verify-request',
			newUser: '/et/files'
		},
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
					session.user = { id: token.id, email: token.email, name: token.name, picture: token.picture };
				} else if (user?.id) {
					session.user.id = user.id;
				}
				return session;
			},
			signIn: async () => {
				return true;
			},
		},
		// Add the events object for logging errors
		events: {
			async error(message) {
			  // This will still log errors encountered by Auth.js internally
			  console.error("Auth.js Error Event:", message);
			}
		  }
	}
	return authOptions satisfies SvelteKitAuthConfig
});
