<script>
	import { user as userStore } from '$lib/stores';

	let loggedIn;
	let initials;

	userStore.subscribe((value) => {
		if (value) {
			loggedIn = true;
			const rgx = new RegExp(/(\p{L}{1})\p{L}+/, 'gu');
			let initialsArr = [...value.name.matchAll(rgx)] || [];
			initials = ((initialsArr.shift()?.[1] || '') + (initialsArr.pop()?.[1] || '')).toUpperCase();
		}
	});
</script>

<div class="navbar mb-2 shadow-lg bg-neutral text-neutral-content rounded-box">
	<div class="px-2 mx-2 navbar-start">
		<a href="/">
			<span class="text-lg font-bold"> Tekstiks </span>
		</a>
	</div>
	<div class="hidden px-2 mx-2 navbar-center lg:flex">
		<div class="flex items-stretch">
			<a href="/" class="btn btn-ghost btn-sm rounded-btn"> Esileht </a>
			<a href="/" class="btn btn-ghost btn-sm rounded-btn"> Demo </a>
			{#if loggedIn}
				<a href="/files" class="btn btn-ghost btn-sm rounded-btn"> Failid </a>
			{/if}
			<a href="/api" class="btn btn-ghost btn-sm rounded-btn"> API </a>
			<a href="/api" class="btn btn-ghost btn-sm rounded-btn"> Panusta </a>
			<a href="/" class="btn btn-ghost btn-sm rounded-btn"> ET </a>
			<a href="/" class="btn btn-ghost btn-sm rounded-btn"> EN </a>
			{#if !loggedIn}
				<a href="/signin" class="btn btn-ghost btn-sm rounded-btn"> Login </a>
			{/if}
			{#if loggedIn}
				<a href="/me" class="btn btn-ghost btn-sm rounded-btn">
					<div class="avatar placeholder">
						<div class="ring ring-primary rounded-full w-8">
							<span class="text-xs">{initials}</span>
						</div>
					</div>
				</a>
			{/if}
		</div>
	</div>
	<div class="navbar-end">
		<button class="btn btn-square btn-ghost" />
	</div>
</div>
