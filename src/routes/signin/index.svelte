<script lang="ts">
	import SignInForm from '$lib/components/SignInForm.svelte';
	import { signin } from '$lib/mutations/signin';
	import { goto } from '$app/navigation';

	let error = null;

	async function handleSubmit({ detail: { email, password } }) {
		const res = await signin(email, password);
		if (res.status === 200) {
			const content = await res.body;
			if (content.user) {
				// $session.user = content.user;
				goto('/files');
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

<div class="tabs flex justify-center">
	<a href="signin" class="tab tab-bordered tab-lg tab-active mr-8">Logi sisse</a> 
	<a href="signup" class="tab tab-bordered tab-lg">Registreeru</a>
</div>
{#if error}
	<p class="mt-3 text-red-500 text-center font-semibold">{JSON.stringify(error)}</p>
{/if}
<SignInForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />
