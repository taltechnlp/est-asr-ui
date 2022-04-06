import { parse } from 'cookie';
import { getSession as getSessionFromApi, createSession } from './routes/api/_db';

/* export async function handle({ event, resolve }) {
	const cookies = parse(event.request.headers.get('cookie') || '');
	console.log('Cookies: ', cookies);
	if (cookies.token) {
		const session = await getSessionFromApi(cookies.token);
		if (session) {
			event.locals.user = { email: session.email };
			return resolve(event);
		} else {
			await createSession();
		}
	}

	event.locals.user = null;
	return resolve(event);
}

export function getSession(event) {
	console.log(event.locals);
	return event.locals.user
		? {
				user: {
					name: event.locals.user.name,
					email: event.locals.user.email,
					id: event.locals.user.id
				}
		  }
		: {};
} */

const checkPath = (event) => {
	return !event.url.pathname.startsWith('/demo') && !event.url.pathname.startsWith('/files/')
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event, {
	  ssr: (()=>checkPath(event))(),
	  transformPage: ({ html }) => html.replace('old', 'new')
	});
   
	return response;
  }
