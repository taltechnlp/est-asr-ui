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
	$: playing = $playingTime >= start && $playingTime <= end;
	$: played = $playingTime > end;

	const handleClick = (e) => {
		e.preventDefault();
		// @ts-ignore
		if (start && window.myPlayer) {
			// @ts-ignore
			const location = start / window.myPlayer.getDuration();
			// @ts-ignore
			window.myPlayer.seekAndCenter(location);
		}
	};
</script>

<NodeViewWrapper class="{playing ? 'playing' : ''} {played ? 'played' : ''}" on:click={handleClick}>
	<span use:editable class="content editable" on:click={handleClick}>{' '}</span>
</NodeViewWrapper>

<style>
</style>
