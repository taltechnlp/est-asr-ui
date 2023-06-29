import { waitLocale } from 'svelte-i18n';
import type { LayoutServerLoad } from '../../.svelte-kit/types/src/routes/$types';

export const load: LayoutServerLoad = async ({ request, locals }) => {
	await waitLocale();
	const session = await locals.getSession();
	if (locals.userId) {
		return {
			id: locals.userId
		};
	} else if (session && session.user) {
		return {
			id: session.user.id
		};
	} else {
		return {};
	}
};
