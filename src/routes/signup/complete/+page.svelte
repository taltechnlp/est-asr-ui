<script lang="ts">
    import type { PageData } from './$types';
    import SignInForm from '$lib/components/SignInForm.svelte';
    import { _ } from 'svelte-i18n';
    import { user as userStore } from '$lib/stores';
    import { goto, invalidateAll } from '$app/navigation';
    import Button from '$lib/components/Button.svelte';
    import { page } from "$app/stores"
    export let data: PageData;
    let error = null;

    async function handleSubmit({detail: {email, password}}) {
		const response = await fetch('/api/signin', {
			method: 'POST',
			body: JSON.stringify({email, password}),
			headers: {
				'Content-Type': 'application/json'
			}
		}).catch(e => console.error("Signin failed"));
		if (!response) {
			error = "Signin request failed!";
			return;
		}
		if (!response.ok) {
			error = (await response.json()).message;
			return;
		}
		else {
			const user = await response.json()
			userStore.set(user);
			goto('/files');
		}
	}

    const printError = (error) => {
		if (error === 'password') {
			return $_('signin.passwordError');
		} else if (error === 'email') {
			return $_('signin.emailError')
		}
		else return error;
	};

</script>

<svelte:head>
	<title>{$_('newAccount.notConnectedHeading')}</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_640px)] m-1">
	<h2 class="text-xl mb-10 font-extrabold mt-6">{$_('newAccount.notConnectedHeading')}</h2>
    <p class="mb-4">
        {$_('newAccount.notConnected')}
    </p>

</div>

<div class="flex flex-col w-full lg:flex-row">
    <div class="grid flex-grow h-48 card border-dashed border-2 rounded-box place-items-center ml-2 mr-2">
        <h3>{$_('newAccount.registerOption')}</h3>
        <a href="/signup?name={$page.data.session && $page.data.session.user && $page.data.session.user.name ? $page.data.session.user.name : ""}&email={
            $page.data.session && $page.data.session.user && $page.data.session.user.email ? $page.data.session.user.email : ""
        }">
            <Button>{$_('newAccount.register')}</Button>    
        </a>
    </div> 
    <div class="divider lg:divider-horizontal">{$_('newAccount.or').toLowerCase()}</div> 
    <div class="grid flex-grow h-80 card border-dashed border-2 rounded-box place-items-center ml-2 mr-2">
        <h3>{$_('newAccount.loginOption')}</h3>
        <SignInForm class="max-w-xl mx-auto" on:submit={handleSubmit} />
        {#if error}
        <p class="mt-3 text-red-500 text-center font-semibold">{printError(error)}</p>
        {/if}

  </div>
</div>