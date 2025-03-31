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
import { uiLanguages } from '$lib/i18n'; // Import your list of languages

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
	// --- Capture lang parameter from the event ---
	const lang = event.params.lang;
	// --- End Capture ---

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
			signIn: "/signin",
			error: '/signin', // Error code passed in query string as ?error=
			verifyRequest: '/auth/verify-request', // (used for check email message)
			newUser: '/files' // New users will be directed here on first sign in (leave the property out if not of interest)
		},
		callbacks: {
			async jwt({ token, user, /* trigger, isNewUser */ }) {
				if (user) {
					token.id = user.id;
					token.email = user.email;
					token.name = user.name;
					token.picture = user.image;
				}
				return token;
			},
			async redirect({ url, baseUrl }) {
				// console.log("redirect cb received:", { originalUrl: url, baseUrl, currentRequestLang: lang });

				// --- Updated Helper Function ---
				const adjustPathForLang = (path: string): string => {
					// 1. Check if the current request even has a language context.
					if (!lang) {
						// If no current lang, remove any existing lang prefix from the path
						// to avoid redirecting to a stale language context.
						// Or redirect to a default language? For now, let's try removing.
						for (const knownLang of uiLanguages) {
							const prefix = `/${knownLang}`;
							if (path === prefix) {
								// console.log(`Path is just lang '${knownLang}', replacing with root '/'`);
								return '/'; // Go to root if path was just the language code
							}
							if (path.startsWith(prefix + '/')) {
								const newPath = path.substring(prefix.length); // Remove '/et' -> '/signin'
								// console.log(`No current lang, removing prefix '${knownLang}' from path:`, { original: path, adjusted: newPath });
								return newPath.startsWith('/') ? newPath : '/' + newPath; // Ensure leading slash
							}
						}
						// console.log("No current lang and no known prefix found in path:", path);
						return path; // No current lang, no known prefix found
					}

					// 2. Current request has a language (lang is defined).
					const targetPrefix = `/${lang}`; // e.g., /et

					// Check if the path *already* starts with the *correct* language prefix.
					if (path === targetPrefix || path.startsWith(targetPrefix + '/')) {
						// console.log("Path already has correct prefix:", path);
						return path; // Already correct
					}

					// Check if the path starts with a *different* known language prefix.
					for (const knownLang of uiLanguages) {
						if (knownLang === lang) continue; // Skip checking against the target lang itself

						const existingPrefix = `/${knownLang}`;
						if (path === existingPrefix) {
							// Path is just the wrong language code (e.g., /fi when lang is et)
							// console.log(`Path is different lang '${knownLang}', replacing with target '${targetPrefix}'`);
							return targetPrefix; // Replace /fi with /et
						}
						if (path.startsWith(existingPrefix + '/')) {
							// Path starts with the wrong language code (e.g., /fi/dashboard when lang is et)
							const restOfPath = path.substring(existingPrefix.length); // Get '/dashboard'
							const newPath = targetPrefix + restOfPath; // Prepend correct lang -> '/et/dashboard'
							// console.log(`Path has different lang prefix '${knownLang}', replacing with target '${targetPrefix}':`, { original: path, adjusted: newPath });
							return newPath;
						}
					}

					// 3. Path does not start with *any* known language prefix. Prepend the target one.
					// Ensure we don't create '//' if the original path is just '/'
					const newPath = `${targetPrefix}${path === '/' ? '' : path}`;
					// console.log("Path has no known prefix, prepending target lang:", { original: path, adjusted: newPath });
					return newPath;
				};
				// --- End Updated Helper Function ---

				// 1. Handle relative URLs (e.g., "/dashboard", "/")
				if (url.startsWith("/")) {
					const adjustedPath = adjustPathForLang(url); // Use the new helper
					const finalUrl = `${baseUrl}${adjustedPath}`;
					// console.log("Redirecting relative URL:", { final: finalUrl });
					return finalUrl;
				}

				// 2. Handle absolute URLs on the same origin
				try {
					const urlObject = new URL(url);
					if (urlObject.origin === baseUrl) {
						const adjustedPath = adjustPathForLang(urlObject.pathname); // Use the new helper
						const finalUrl = `${baseUrl}${adjustedPath}${urlObject.search}${urlObject.hash}`;
						// console.log("Redirecting same-origin absolute URL:", { final: finalUrl });
						return finalUrl;
					}
				} catch (e) {
					console.warn("Could not parse redirect URL, falling back:", url, e);
				}

				// 3. Fallback: Redirect to the app's base URL, adjusted for the current language context.
				const adjustedBasePath = adjustPathForLang('/'); // Adjust the root path '/'
				const finalUrl = `${baseUrl}${adjustedBasePath}`;
				// console.log("Redirecting fallback to base:", { final: finalUrl });
				return finalUrl;
			},
			async session({ session, token, user, newSession, trigger }) {
				if (token) {
					session.user = {
						id: token.id,
						email: token.email,
						name: token.name,
						picture: token.picture
					};
				}
				else if (user.id) {
					session.user.id = user.id;
				}
				return session;
			},
			signIn: async () => {
				return true;
			},
		} 
	}
	return authOptions satisfies SvelteKitAuthConfig
});
