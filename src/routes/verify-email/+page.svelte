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

    let currentEmail = $state($page.url.searchParams.get('email') ?? '');
    let newEmail = $state('');
    let password = $state('');
    let isChanging = $state(false);
    let changeOpened = $state(false);
    // Keep the form open after a failed submit so the error stays visible.
    let showChange = $derived(changeOpened || (!!form?.change && form.change !== 'sent'));

    const changeErrorText = (code: string) => {
        switch (code) {
            case 'missing': return $_('verifyEmail.changeMissing');
            case 'invalidEmail': return $_('verifyEmail.changeInvalidEmail');
            case 'invalidCredentials': return $_('verifyEmail.changeInvalidCredentials');
            case 'alreadyVerified': return $_('verifyEmail.changeAlreadyVerified');
            case 'sameEmail': return $_('verifyEmail.changeSameEmail');
            case 'emailTaken': return $_('verifyEmail.changeEmailTaken');
            default: return $_('verifyEmail.changeError');
        }
    };
</script>

<svelte:head>
    <title>{$_('verifyEmail.title')}</title>
</svelte:head>

<div class="max-w-xl mx-auto mt-8">
    <h1 class="text-2xl font-extrabold">{$_('verifyEmail.header')}</h1>

    {#if data.status === 'verified'}
        <p class="mt-6 text-green-700 font-semibold">{$_('verifyEmail.success')}</p>
        <p class="mt-3"><a href="/signin" class="link">{$_('verifyEmail.toSignin')}</a></p>
    {:else if data.status === 'changed'}
        <p class="mt-6 text-green-700 font-semibold">{$_('verifyEmail.changed')}</p>
        <p class="mt-3"><a href="/signin" class="link">{$_('verifyEmail.toSignin')}</a></p>
    {:else if data.status === 'changeConflict'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.changeConflict')}</p>
    {:else if data.status === 'expired'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.expired')}</p>
    {:else if data.status === 'invalid'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.invalid')}</p>
    {:else if data.status === 'error'}
        <p class="mt-6 text-red-500 font-semibold">{$_('verifyEmail.error')}</p>
    {:else if data.status === 'noToken'}
        <p class="mt-6">{$_('verifyEmail.resendIntro')}</p>
    {/if}

    {#if data.status !== 'verified' && data.status !== 'changed'}
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

        <div class="mt-12 border-t border-base-300 pt-8">
            <h2 class="text-xl font-bold">{$_('verifyEmail.changeHeader')}</h2>
            <p class="mt-2">{$_('verifyEmail.changeIntro')}</p>

            {#if form?.change === 'sent'}
                <p class="mt-4 text-green-700 font-semibold">
                    {$_('verifyEmail.changeSent', { values: { email: form.newEmail } })}
                </p>
            {:else}
                {#if !showChange}
                    <button class="btn btn-outline btn-sm mt-4" onclick={() => (changeOpened = true)}>
                        {$_('verifyEmail.changeOpen')}
                    </button>
                {:else}
                    <form
                        method="POST"
                        action="?/change"
                        class="space-y-5 mt-6"
                        use:enhance={() => {
                            isChanging = true;
                            return async ({ update }) => {
                                isChanging = false;
                                await update({ reset: false });
                            };
                        }}
                    >
                        <Input
                            label={$_('verifyEmail.currentEmail')}
                            id="currentEmail"
                            name="currentEmail"
                            type="email"
                            autocomplete="email"
                            bind:value={currentEmail}
                            required
                        />
                        <Input
                            label={$_('verifyEmail.password')}
                            id="password"
                            name="password"
                            type="password"
                            autocomplete="current-password"
                            bind:value={password}
                            required
                        />
                        <Input
                            label={$_('verifyEmail.newEmail')}
                            id="newEmail"
                            name="newEmail"
                            type="email"
                            autocomplete="off"
                            bind:value={newEmail}
                            required
                        />
                        <Button type="submit" loading={isChanging}>
                            {$_('verifyEmail.changeButton')}
                        </Button>
                    </form>
                    {#if form?.change}
                        <p class="mt-3 text-red-500 text-center font-semibold">{changeErrorText(form.change)}</p>
                    {/if}
                {/if}
            {/if}
        </div>
    {/if}
</div>
