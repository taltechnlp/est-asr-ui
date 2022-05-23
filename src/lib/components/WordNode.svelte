<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, editable } from 'svelte-tiptap';
	export let node: NodeViewProps['node'];
	export let decorations: NodeViewProps['decorations'];
	export let extension: NodeViewProps['extension'];
	export let updateAttributes: NodeViewProps['updateAttributes'];
	export let deleteNode: NodeViewProps['deleteNode'];
	export let editor: NodeViewProps['editor'];
	export let getPos: NodeViewProps['getPos'];
	export let selected: NodeViewProps['selected'] = false;
	import { playingTime } from '$lib/stores';

	let start = parseFloat(node.attrs['start']);
	let end = parseFloat(node.attrs['end']);
	$: playing = $playingTime >= start // && $playingTime <= end
</script>

<NodeViewWrapper class="{playing ? "playing" : ""}">
	<span use:editable class="content editable"></span>
</NodeViewWrapper>

<style>
	
</style>
