import type { Handle } from '@sveltejs/kit';
import { sequence } from "@sveltejs/kit/hooks";
import { handle as authHandle } from "./auth"

async function transformHtml({ event, resolve }) {
	return await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('old', 'new')
	});
}

export const handle: Handle = sequence( authHandle, transformHtml)