<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLTableAttributes } from "svelte/elements";

	type $$Props = HTMLTableAttributes;

	interface Props {
		class?: $$Props["class"];
		children?: import('svelte').Snippet;
		[key: string]: any
	}

	let { class: className = undefined, children, ...rest }: Props = $props();
	
</script>

<div class="w-full overflow-auto">
	<table class={cn("w-full caption-bottom text-sm", className)} {...rest}>
		{@render children?.()}
	</table>
</div>
