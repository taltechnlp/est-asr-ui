import type { PageServerLoad, Action } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const code = url.searchParams.get('code');
	return new Response(String(code.toString()));
};
