<script context="module">
    export async function load({ params, url}) {
      const resetToken = url.searchParams.get('resetToken') || '';
      return {
        status: 200,
        props: {
            resetToken
        }
      };
    }
</script>

<script>
	import PasswordResetForm from '$lib/components/PasswordResetForm.svelte';
	import { resetPassword } from './index.json';
	import { _ } from 'svelte-i18n';

    export let resetToken;
	let error;

    // console.log("token", resetToken)
	async function handleSubmit({ detail: { password } }) {
		const res = await resetPassword(password, resetToken);
		if (res.status === 200) {
			const data = await res.body;
			window.location.href = '/signin';
			return { props: { data } };
		} else {
			error = await res.body;
			return;
		}
	}
	const printError = (error) => {
		if (error.error === 'passwordReset.error') {
			return $_('passwordReset.error');
		} else return error.error;
	};
</script>

<svelte:head>
	<title>{$_('passwordReset.header')}</title>
</svelte:head>

{#if error}
	<p class="mt-3 text-red-500 text-center font-semibold">{printError(error)}</p>
{/if}
<PasswordResetForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />