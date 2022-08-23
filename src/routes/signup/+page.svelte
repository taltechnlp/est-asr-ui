<script>
	import SignUpForm from '$lib/components/SignUpForm.svelte';
	import { signup } from './index.json';
	import { _ } from 'svelte-i18n';

	let error;

	async function handleSubmit({ detail: { email, password, name } }) {
		const res = await signup(email, password, name);
		if (res.status === 200) {
			const data = await res.body;
			window.location.href = '/files';
			return { props: { data } };
		} else {
			error = await res.body;
			return;
		}
	}
	const printError = (error) => {
		if (error.error === 'signin.error') {
			return $_('signin.error');
		} else return error.error;
	};
</script>

<svelte:head>
	<title>{$_('signup.header')}</title>
</svelte:head>

<div class="tabs flex justify-center">
	<a href="signin" class="tab tab-bordered tab-lg mr-8">Logi sisse</a>
	<a href="signup" class="tab tab-bordered tab-lg tab-active">Registreeru</a>
</div>
{#if error}
	<p class="mt-3 text-red-500 text-center font-semibold">{printError(error)}</p>
{/if}
<SignUpForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />
