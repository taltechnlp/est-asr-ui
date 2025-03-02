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
                    console.log("credentials:", credentials, "user:", user);
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
				//console.log("redirect cb", url, baseUrl)
				// Allows relative callback URLs
				if (url.startsWith("/")) return `${baseUrl}${url}`
			 
				// Allows callback URLs on the same origin
				if (new URL(url).origin === baseUrl) return url
			 
				return baseUrl
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
