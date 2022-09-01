import {parse} from 'cookie';
import jwt from 'jsonwebtoken'
import type { Handle } from '@sveltejs/kit';
import { SECRET_KEY } from '$env/static/private';

const checkPath = (event) => {
	return !event.url.pathname.startsWith('/demo') && !event.url.pathname.startsWith('/files/');
};

export const handle: Handle = async ({ event, resolve }) => {
	const cookie = await parse(event.request.headers.get('cookie') || '');
	if (cookie.token) {
		const userDetails = jwt.verify(cookie.token, SECRET_KEY);
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

