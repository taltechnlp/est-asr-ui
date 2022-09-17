import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import type { LayoutServerLoad } from '../../.svelte-kit/types/src/routes/$types';
import { SECRET_KEY } from '$env/static/private';

export async function preload() {
	return waitLocale();
}
export const load: LayoutServerLoad = async ({ request }) => {
	const cookie = await parse(request.headers.get('cookie') || '');
	if (cookie.token) {
		const userDetails = jwt.verify(cookie.token, SECRET_KEY);
		if (userDetails.userId) {
			return {userId: userDetails.userId}
		} else {
			return {};
		}
	} else return {};
}
