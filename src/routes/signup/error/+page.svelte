<script lang="ts">
    import type { PageData } from './$types';
   import { _ } from 'svelte-i18n';

    export let data: PageData;
</script>

<svelte:head>
	<title>{$_('me.title')}</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_640px)] m-1">
	<div class="grid grid-cols-2 gap-5">
		error
	</div>
	<div class="mt-10">

	</div>
</div>