import {parse} from 'cookie';
import jwt from 'jsonwebtoken'
import {variables} from '$lib/variables'

const checkPath = (event) => {
	return !event.url.pathname.startsWith('/demo') && !event.url.pathname.startsWith('/files/');
};

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const cookie = await parse(event.request.headers.get('cookie') || '');
	if (cookie.token) {
		const userDetails = jwt.verify(cookie.token, variables.secretKey);
		if(userDetails.userId){
			event.locals.userId = userDetails.userId
		}
	}

	const response = await resolve(event, {
		ssr: (() => checkPath(event))(),
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});

	return response;
}

/** @type {import('@sveltejs/kit').GetSession} */
export function getSession(event) {
	return event.locals.userId
	  ? {
		  userId: event.locals.userId
		}
	  : {};
  }
