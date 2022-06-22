<script lang="ts">
	import { _ } from 'svelte-i18n';
    import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
    import { pwReset } from '$lib/mutations/passwordReset';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();
    let submitted = false;
    let success = false;
    let email = '';
	async function handleSubmit({ detail: { email } }) {
		const res = await pwReset(email);
        submitted = true;
		if (res.status === 200) {
            success = true
		} else {
			success = false
		}
	}
	const printError = (error) => {
		if (error.error === 'reset.error') {
			return $_('passwordReset.error');
		} else return error.error;
	};
</script>

<svelte:head>
	<title>{$_('passwordReset.title')}</title>
</svelte:head>

<h1 class="max-w-xl mx-auto mt-8 text-2xl font-extrabold">{$_('passwordReset.header')}</h1>
<div class="max-w-xl mx-auto mt-8">
	<form on:submit={(email)=>handleSubmit({ detail: { email } })} class="space-y-5 {$$props.class}">
        <Input
            label={$_('signin.email')}
            id="email"
            name="email"
            type="email"
            bind:value={email}
            required
        />
        <Button type="submit">{$_('passwordReset.submit')}</Button>
    </form>
    {#if submitted && !success}
        <p class="mt-3 text-red-500 text-center font-semibold">{printError("reset.error")}</p>
    {:else if submitted && success}
    <p class="mt-3 text-center font-semibold">{$_('passwordReset.success')}</p>
    {/if}
</div>
