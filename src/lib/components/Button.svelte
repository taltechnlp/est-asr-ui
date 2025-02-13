<script lang="ts">
	interface Props {
		type?: string;
		children?: import('svelte').Snippet;
	}

	let { type = 'button', children }: Props = $props();
</script>

<button
	{type}
	class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
>
	{@render children?.()}
</button>