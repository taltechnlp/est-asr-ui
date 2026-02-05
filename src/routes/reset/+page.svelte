<script lang="ts">
	import PasswordResetForm from '$lib/components/PasswordResetForm.svelte';
	import { _ } from 'svelte-i18n';
	import Button from '$lib/components/Button.svelte';
	let { data, error = $bindable() }: { data: any; error?: any } = $props();

	async function handleSubmit({ detail: { password } }) {
		const res = await fetch ("/api/reset", {
			method: 'POST',
			body: JSON.stringify({password, resetToken: data.resetToken}),
			headers: {
				'Content-Type': 'application/json'
			}
		}).catch(e => console.error("Password reset request failed."));
		if (!res) {
			error = "Password reset request failed."
			return;
		}
		if (res.status === 200) {
			const data = await res.body;
			// console.log(data)
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
		} else return $_('passwordReset.error');
	};
</script>

<svelte:head>
	<title>{$_('passwordReset.header')}</title>
</svelte:head>

{#if error}
	<p class="mt-3 text-red-500 text-center font-semibold">{printError(error)}</p>
{/if}
{#if !data.valid}
	<div class="max-w-xl mx-auto mt-8 space-y-5">
		<p>{$_('passwordReset.expired')}</p>
		<a href="/password-reset" class="flex place-content-between">
			<Button>{$_('passwordReset.requestNewToken')}</Button>
		</a>
	</div>
	{:else}
	<PasswordResetForm class="max-w-xl mx-auto mt-8" on:submit={handleSubmit} />
{/if}
