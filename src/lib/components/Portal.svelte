<script lang="ts">
	import { onMount } from 'svelte';

	let portal: HTMLDivElement;
	let target: HTMLElement;

	onMount(() => {
		target = document.body;
		target.appendChild(portal);
		
		return () => {
			if (target && portal) {
				target.removeChild(portal);
			}
		};
	});
</script>

<div bind:this={portal}>
	<slot />
</div>