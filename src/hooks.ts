import {parse} from 'cookie';
import jwt from 'jsonwebtoken'
import {variables} from '$lib/variables';
import type { Handle } from '@sveltejs/kit';

const checkPath = (event) => {
	return !event.url.pathname.startsWith('/demo') && !event.url.pathname.startsWith('/files/');
};

export const handle: Handle = async ({ event, resolve }) => {
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

