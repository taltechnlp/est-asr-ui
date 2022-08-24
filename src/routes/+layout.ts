import { error } from '@sveltejs/kit';
import { user as userStore } from '$lib/stores';
import { waitLocale } from 'svelte-i18n';

export async function preload() {
	return waitLocale();
}

export async function load({ fetch, parent, data }) {
	if (data.userId) {
		const response = await fetch('/api/user/' + data.userId, {
			method: 'GET',
		}).catch((e) => {
			return {
				status: 404,
				error: 'userNotFound'
			};
		});
		const { body } = await response.json();
		console.log("user", body.user)
		if (body.user) {
			userStore.set(body.user);
			return body.user;
		} else
			throw error(404, 'userNotFound');

	}
	else return;
}

// import { user as userStore } from '$lib/stores';
// import { waitLocale } from 'svelte-i18n';

// export async function preload() {
// 	return waitLocale();
// }

// export async function load({ params, fetch, session, stuff }) {
// 	if (session.userId) {
// 		const response = await fetch('/api/user/' + session.userId, {
// 			method: 'GET',
// 			/* body: JSON.stringify({ userId: session.userId }), */
// 			/* headers: {
// 				'Content-Type': 'application/json'
// 			} */
// 		}).catch((e) => {
// 			return {
// 				status: 404,
// 				error: 'userNotFound'
// 			};
// 		});
// 		const { user } = await response.json();
// 		if (user) {
// 			userStore.set(user);
// 			return {
// 				status: 200
// 			};
// 		} else
// 			return {
// 				status: 404,
// 				error: 'userNotFound'
// 			};
// 	} else {
// 		return {
// 			status: 200
// 		};
// 	}
// }
