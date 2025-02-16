<script lang="ts">
	import { userState, lang as langStore } from '$lib/stores.svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import Logo from '$lib/components/Logo.svelte';
	import { createEventDispatcher } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { uiLanguages } from './i18n';
	let { language } = $props();

	let loggedIn = $derived(userState.id.length > 0);
	const rgx = new RegExp(/(\p{L}{1})\p{L}+/, 'gu');
	let initials = $derived.by(() => {
		let initialsArr = [...userState.name.matchAll(rgx)];
		return ((initialsArr.shift()?.[1] || '') + (initialsArr.pop()?.[1] || '')).toUpperCase();
	});

	let path = $state('');
	afterNavigate((nav) => {
		path = nav.to.url.pathname;
		return;
	});

	const languageDict = {
		et: { id: 'et', text: 'ET', flag: [0x1f1ea, 0x1f1ea] },
		en: { id: 'en', text: 'EN', flag: [0x1f1ec, 0x1f1e7] },
		fi: { id: 'fi', text: 'FI', flag: [0x1f1eb, 0x1f1ee] }
	};
	const languages = uiLanguages;

	let currentLanguage: string = $state(language || "et");
	locale.set(currentLanguage); 
	locale.subscribe(lang => {
		currentLanguage = lang}
	)

	const dispatch = createEventDispatcher();

	function switchLocale(event) {
		event.preventDefault();
		locale.set(event.target.value);
		localStorage.setItem("language", event.target.value)
		dispatch('locale-changed', event.target.value);
		let newPath = path;
		let hasLangInUrl = false;
		uiLanguages.forEach(l => {
			if (newPath.startsWith('/' + l + '/')) hasLangInUrl = true;
			else if (newPath.length == 3 && newPath.startsWith('/' + l)) hasLangInUrl = true;
		});
		if (hasLangInUrl) newPath = newPath.substring(3);
		newPath = '/' + event.target.value + newPath;
		goto(newPath);
	}

	function toggleMenu() {
		var x = document.getElementById('mobileMenu');
		if (x.style.display === 'none') {
			x.style.display = 'block';
		} else {
			x.style.display = 'none';
		}
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
				<a href="/" class="btn btn-ghost btn-md rounded-btn {path == '/' || uiLanguages.includes(path.substring(1)) ? 'text-orange-600' : ''}">
					{$_('index.headerTitle')}
				</a>
				{#if loggedIn}
					<a
						href="/files"
						class="btn btn-ghost btn-md rounded-btn {path.includes('/files') ? 'text-orange-600' : ''}"
					>
						{$_('index.headerFiles')}
					</a>
				{/if}
				<a
					href="/demo"
					class="btn btn-ghost btn-md rounded-btn {path.includes('/demo') ? 'text-orange-600' : ''}"
				>
					{$_('index.headerDemo')}
				</a>
				<select class="select select-ghost max-w-xs" bind:value={currentLanguage} onchange={switchLocale}>
					{#each languages as value}
						<option {value}>
							{String.fromCodePoint(
								languageDict[value].flag[0],
								languageDict[value].flag[1]
							)}
							{languageDict[value].text}
						</option>
					{/each}
				</select>
				{#if !loggedIn}
					<a
						href="/signin"
						class="btn btn-ghost btn-md rounded-btn {path.includes('/signin') ? 'text-orange-600' : ''}"
					>
						{$_('index.login')}
					</a>
				{/if}
				{#if loggedIn}
					<a
						href="/me"
						class="btn btn-ghost btn-md rounded-btn {path.includes('/me') ? 'text-orange-600' : ''}"
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
		<div class="grid sm:hidden">
			<button class="btn btn-square btn-ghost justify-self-end" onclick={toggleMenu}>
				
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="inline-block w-5 h-5 stroke-current"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/></svg
				>
			</button>
			<ul
				class="menu bg-white w-24 rounded-box fixed right-0 top-14 z-30 shadow-lg"
				id="mobileMenu"
				style="display: none;"
			>
				<li>
					<a
						href="/"
						class="btn btn-ghost btn-md rounded-btn {path == '/' || uiLanguages.includes(path.substring(1)) ? 'text-orange-600' : ''}"
					>
						{$_('index.headerTitle')}
					</a>
				</li>
				{#if loggedIn}
					<li>
						<a
							href="/files"
							class="btn btn-ghost btn-md rounded-btn {path.includes('/files') ? 'text-orange-600' : ''}"
						>
							{$_('index.headerFiles')}
						</a>
					</li>
				{/if}
				<li>
					<a
						href="/demo"
						class="btn btn-ghost btn-md rounded-btn {path.includes('/demo') ? 'text-orange-600' : ''}"
					>
						{$_('index.headerDemo')}
					</a>
				</li>
				<li>
					<select class="select max-w-xs" bind:value={currentLanguage} onchange={switchLocale}>
						{#each languages as value}
							<option {value}>
								{String.fromCodePoint(
									languageDict[value].flag[0],
									languageDict[value].flag[1]
								)}
								{languageDict[value].text}
							</option>
						{/each}
					</select>
				</li>
				{#if !loggedIn}
					<li>
						<a
							href="/signin"
							class="btn btn-ghost btn-md rounded-btn {path.includes('/signin') ? 'text-orange-600' : ''}"
						>
							{$_('index.login')}
						</a>
					</li>
				{/if}
				{#if loggedIn}
					<li>
						<a
							href="/me"
							class="btn btn-ghost btn-md rounded-btn {path.includes('/me') ? 'text-orange-600' : ''}"
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
					</li>
				{/if}
			</ul>
		</div>
		<!-- <div class="navbar-end">
		<button class="btn btn-square btn-ghost" />
	</div> -->
	</div>
</div>
