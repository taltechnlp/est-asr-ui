<script>
	import { user as userStore, lang as langStore } from '$lib/stores';
	import { afterNavigate } from '$app/navigation';
	import Logo from '$lib/components/Logo.svelte';
	import { createEventDispatcher } from 'svelte';
	import { _, locale } from 'svelte-i18n';

	let loggedIn;
	let initials;
	userStore.subscribe((value) => {
		if (value && value.name) {
			loggedIn = true;
			const rgx = new RegExp(/(\p{L}{1})\p{L}+/, 'gu');
			let initialsArr = [...value.name.matchAll(rgx)] || [];
			initials = ((initialsArr.shift()?.[1] || '') + (initialsArr.pop()?.[1] || '')).toUpperCase();
		} else loggedIn = false;
	});
	let path = '';
	afterNavigate((nav) => {
		path = nav.to.pathname;
		return;
	});

	const languageDict = {
		et: { id: 'et', text: 'ET', flag: [0x1f1ea, 0x1f1ea] },
		en: { id: 'en', text: 'EN', flag: [0x1f1ec, 0x1f1e7] }
	};
	const languages = ['et', 'en'];

	let selected;

	const dispatch = createEventDispatcher();

	function switchLocale(event) {
		event.preventDefault();
		locale.set(event.target.value);
		dispatch('locale-changed', event.target.value);
	}
</script>

<div class="max-w-screen-2xl w-full">
	<div class="navbar bg-base-100 flex justify-between w-full">
		<div class="px-2 mx-2 navbar-start">
			<a href="/">
				<span class="text-lg font-bold flex place-items-center">
					<Logo />
					<span class="ml-3 text-xl"> Tekstiks </span>
				</span>
			</a>
		</div>
		<div class="hidden navbar-end sm:flex">
			<div class="flex">
				<a href="/" class="btn btn-ghost btn-md rounded-btn {path == '/' ? 'text-orange-600' : ''}">
					{$_('index.headerTitle')}
				</a>
				{#if loggedIn}
					<a
						href="/files"
						class="btn btn-ghost btn-md rounded-btn {path == '/files' ? 'text-orange-600' : ''}"
					>
						{$_('index.headerFiles')}
					</a>
				{/if}
				<a
					href="/demo"
					class="btn btn-ghost btn-md rounded-btn {path == '/demo' ? 'text-orange-600' : ''}"
				>
					{$_('index.headerDemo')}
				</a>
				<select class="select select-ghost max-w-xs" bind:value={selected} on:change={switchLocale}>
					{#each languages as language}
						<option value={language}>
							<span class="">
								{String.fromCodePoint(
									languageDict[language].flag[0],
									languageDict[language].flag[1]
								)}
							</span>
							<span class="">
								{languageDict[language].text}
							</span>
						</option>
					{/each}
				</select>
				{#if !loggedIn}
					<a
						href="/signin"
						class="btn btn-ghost btn-md rounded-btn {path == '/signin' ? 'text-orange-600' : ''}"
					>
						{$_('index.login')}
					</a>
				{/if}
				{#if loggedIn}
					<a
						href="/me"
						class="btn btn-ghost btn-md rounded-btn {path == '/me' ? 'text-orange-600' : ''}"
					>
						<div class="avatar placeholder">
							<div class="rounded-bt">
								<span class="h-4 w-4">
									<svg xmlns="http://www.w3.org/2000/svg" id="Outline" viewBox="0 0 24 24"
										><path
											d="M12,12A6,6,0,1,0,6,6,6.006,6.006,0,0,0,12,12ZM12,2A4,4,0,1,1,8,6,4,4,0,0,1,12,2Z"
										/><path
											d="M12,14a9.01,9.01,0,0,0-9,9,1,1,0,0,0,2,0,7,7,0,0,1,14,0,1,1,0,0,0,2,0A9.01,9.01,0,0,0,12,14Z"
										/></svg
									>
								</span>
								<span class="ml-1">{initials}</span>
							</div>
						</div>
					</a>
				{/if}
			</div>
		</div>
		<!-- <div class="navbar-end">
		<button class="btn btn-square btn-ghost" />
	</div> -->
	</div>
</div>
