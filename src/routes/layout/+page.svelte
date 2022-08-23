<script context="module">
	throw new Error("@migration task: Check code was safely removed (https://github.com/sveltejs/kit/discussions/5774#discussioncomment-3292722)");

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
</script>

<script>
	import Nav from '$lib/nav.svelte';
	import '../app.css';
	import '../i18n';
</script>

<div class="w-full flex justify-center">
	<Nav />
</div>

<main class="">
	<slot />
</main>
