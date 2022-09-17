<script lang="ts">
	import { _ } from 'svelte-i18n';
    import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
    import type { PageData, ActionData } from './$types'

    export let data: PageData;
    export let form: ActionData;
    let email = '';
	const printError = (error) => {

		return $_('passwordReset.error');
	};
</script>

<svelte:head>
	<title>{$_('passwordReset.title')}</title>
</svelte:head>

<h1 class="max-w-xl mx-auto mt-8 text-2xl font-extrabold">{$_('passwordReset.header')}</h1>
<div class="max-w-xl mx-auto mt-8">
	<form method="POST" class="space-y-5">
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
    {#if form?.doesNotExist}
        <p class="mt-3 text-red-500 text-center font-semibold">{printError("reset.error")}</p>
    {:else if form?.success}
    <p class="mt-3 text-center font-semibold">{$_('passwordReset.success')}</p>
    {/if}
</div>
