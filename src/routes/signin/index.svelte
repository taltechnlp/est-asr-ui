<script context="module">
	export async function load({ session }) {
		if (session.user) {
			return {
				status: 302,
				redirect: '/'
			};
		}
		return {};
	}
</script>

<script lang="ts">
	import SignInForm from '$lib/components/SignInForm.svelte';
	import { signin } from '$lib/mutations/signin';
	import { session } from '$app/stores';
	import { goto } from '$app/navigation';

	let error = null;

	async function handleSubmit({ detail: { email, password } }) {
		const res = await signin(email, password);
		if (res.status === 200) {
			const content = await res.body;
			if (content.user) {
				// $session.user = content.user;
				goto('/');
			} else {
				console.log('Server error: no user details.');
			}
			// window.location.href = '/protected';
			return { props: { content } };
		} else {
			error = await res.body;
			console.log(error);
			return;
		}
	}
</script>

<h1 class="text-2xl font-semibold text-center">Logi sisse</h1>
{#if error}
	<p class="mt-3 text-red-500 text-center font-semibold">{JSON.stringify(error)}</p>
{/if}
<SignInForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />
