<script lang="ts">
    import { _ } from 'svelte-i18n';
    import { enhance } from '$app/forms';
    import Input from '$lib/components/Input.svelte';
    import Button from '$lib/components/Button.svelte';
    import { page } from '$app/stores';
    import type { PageProps } from './$types';

    let { data, form }: PageProps = $props();

    let email = $state($page.url.searchParams.get('email') ?? '');
    let isLoading = $state(false);
</script>

<svelte:head>
    <title>{$_('verifyEmail.title')}</title>
</svelte:head>

<div class="max-w-xl mx-auto mt-8">
    <h1 class="text-2xl font-extrabold">{$_('verifyEmail.header')}</h1>

    {#if data.status === 'verified'}
        <p class="mt-6 text-green-700 font-semibold">{$_('verifyEmail.success')}</p>
        <p class="mt-3"><a href="/signin" class="link">{$_('verifyEmail.toSignin')}</a></p>
    {:else if data.status === 'expired'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.expired')}</p>
    {:else if data.status === 'invalid'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.invalid')}</p>
    {:else if data.status === 'error'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.error')}</p>
    {:else if data.status === 'noToken'}
        <p class="mt-6">{$_('verifyEmail.resendIntro')}</p>
    {/if}

    {#if data.status !== 'verified'}
        <form
            method="POST"
            action="?/resend"
            class="space-y-5 mt-8"
            use:enhance={() => {
                isLoading = true;
                return async ({ update }) => {
                    isLoading = false;
                    await update();
                };
            }}
        >
            <Input
                label={$_('verifyEmail.email')}
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                bind:value={email}
                required
            />
            <Button type="submit" loading={isLoading}>
                {$_('verifyEmail.resend')}
            </Button>
        </form>
        {#if form?.resendSuccess}
            <p class="mt-3 text-center font-semibold">{$_('verifyEmail.resendSuccess')}</p>
        {:else if form?.resendInvalid}
            <p class="mt-3 text-red-500 text-center font-semibold">{$_('verifyEmail.resendInvalid')}</p>
        {/if}
    {/if}
</div>
