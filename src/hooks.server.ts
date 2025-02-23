import { parse } from 'cookie';
import jwt from 'jsonwebtoken'
import type { Handle } from '@sveltejs/kit';
import { SECRET_KEY } from '$env/static/private';
import { SvelteKitAuth } from "@auth/sveltekit"
// import GitHub from '@auth/core/providers/github';
import Facebook from '@auth/core/providers/facebook';
import Google from '@auth/core/providers/google';
import Credentials from "@auth/sveltekit/providers/credentials"
// import EmailProvider from "@auth/core/providers/email"
import { /* GITHUB_ID, GITHUB_SECRET, */ AUTH_SECRET, FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL } from "$env/static/private";
import { sequence } from "@sveltejs/kit/hooks";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "$lib/db/client";
import bcrypt from 'bcrypt';
import { handle as authHandle } from "./auth"

/* async function pwdAuthorization({ event, resolve }) {
	const token = event.cookies.get('token');
	if (token) { // Logged in via pw
		const userDetails = jwt.verify(token, SECRET_KEY);
		if (userDetails.userId) {
			event.locals.userId = userDetails.userId
		}
	}
	else {
		const cookieString = event.request.headers.get('cookie') || '';
  		const cookies = await parse(cookieString);
		console.log("Cookies", cookies);
	}
	return resolve(event);
} */
async function transformHtml({ event, resolve }) {
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}


export const handle: Handle = sequence( authHandle, transformHtml)