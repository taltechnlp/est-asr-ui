<script>
	import SignUpForm from '$lib/components/SignUpForm.svelte';
	import { signup } from './index.json';

	let error;

	async function handleSubmit({ detail: { email, password, name } }) {
		const res = await signup(email, password, name);
		if (res.status === 200) {
			const data = await res.body;
			if (data && data.user) {
				// user.set(data.user);
				console.log(data.user);
			}
			window.location.href = '/protected';
			return { props: { data } };
		} else {
			error = await res.body;
			console.log(error);
			return;
		}
	}
</script>

<h1 class="text-2xl font-semibold text-center">Sign Up</h1>
{#if error}
	<p class="mt-3 text-red-500 text-center font-semibold">{JSON.stringify(error)}</p>
{/if}
<SignUpForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />
