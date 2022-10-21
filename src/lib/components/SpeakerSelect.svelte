<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, editable } from 'svelte-tiptap';
	import { onMount, onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import { clickOutside } from './clickOutside';
	import type { Speaker } from '$lib/helpers/converters/types'

	export let node: NodeViewProps['node'];
	export let decorations: NodeViewProps['decorations'];
	export let extension: NodeViewProps['extension'];
	export let updateAttributes: NodeViewProps['updateAttributes'];
	export let deleteNode: NodeViewProps['deleteNode'];
	export let editor: NodeViewProps['editor'];
	export let getPos: NodeViewProps['getPos'];
	export let selected: NodeViewProps['selected'] = false;
	import { speakerNames, addSpeakerName, editorMounted } from '$lib/stores';

	import { _ } from 'svelte-i18n';

	let isListOpen = false;
	let initialName = node.attrs['data-name'];
	let selectedVal = $speakerNames.find( s => s.name === initialName )

	let newSpeaker = '';
	let editSpeakerId = '';
	let editingValue = '';
	$: names = $speakerNames.reduce((acc, curr) => {
		if (acc.find(x=>x.id===curr.id)) return acc;
		else {
			acc.push(curr)
			return acc;}
	}, ([] as Array<Speaker>));

	const findTimeStamps = (startPos) => {
		let i = 0;
		let done = false;
		let startTime = null;
		do {
			node = editor.state.doc.nodeAt(startPos + i);
			if (node && node.marks.length > 0) {
				for (let j = 0; j < node.marks.length; j++) {
					// @ts-ignore
					if (node.marks[0].attrs.start) {
						// @ts-ignore
						startTime = node.marks[0].attrs.start;
						done = true;
						break;
					}
				}
			}
			if (done) break;
			i++;
		} while (!done && node);
		
		return startTime;
	};

	$: time = findTimeStamps(getPos() + 1);

	const handleClick = () => {
		isListOpen ? (isListOpen = false) : (isListOpen = true);
		if (!isListOpen) {
			newSpeaker = '';
			editSpeakerId = '';
			editingValue = '';
		}
	};

	const handleNewSpeakerSave = (name, start) => {
		if (name.length > 0) {
			const selectedId = addSpeakerName(name, start);
			selectedVal = $speakerNames.find(s => s.id === selectedId);
			updateAttributes({'data-name': name});
			newSpeaker = '';
		}
		handleClick();
	};

	const handleKeypress = (e, name) => {
		if (e.charCode === 13) handleNewSpeakerSave(name, time);
	};

	const selectSpeaker = (id) => {
		selectedVal = $speakerNames.find(s => s.id === id);
		updateAttributes({ 'data-name': selectedVal.name });
	};

	const handleStartEdit = (speaker) => {
		editSpeakerId = speaker.id;
		editingValue = speaker.name;
	};

	const handleRenameAll = (speaker) => {
		const speakerNodes = editor.view.state.doc.content;
		const name = speaker.name
		speakerNodes.forEach((node) =>
			// @ts-ignore
			node.attrs['data-name'] === name ? (node.attrs['data-name'] = editingValue) : null
		);
		speakerNames.update((speakers) => {
			speakers = speakers.map(s => {
				if (s.id===speaker.id) {return {
					id: s.id,
					name: editingValue,
					start: s.start
				}} else return s;
			})
			return speakers; 
		});
		// updateAttributes({ 'data-name': getSpeakerName(speakerId) });
		
		// updateAttributes({ 'data-name': editingValue });
		editingValue = '';
		editSpeakerId = '';
	};

	const numberToTime = (number) => {
		if (number) {
			const nr = parseFloat(number);
			const time = new Date(0);
			time.setSeconds(nr);
			return nr < 60 ? time.toISOString().substr(14, 5) : time.toISOString().substr(11, 8);
		} else return '';
	};

	onMount(async () => {
		if ($editorMounted) {
			const id = addSpeakerName(selectedVal.name, time);
		}
	})

	onDestroy(async () => {
		if ($editorMounted) {
			speakerNames.update(sps => 
				sps.filter(s=>!(s.id===selectedVal.id && s.start===time))
			)
		}
	})
</script>

<NodeViewWrapper class="svelte-component speaker {selected}">
	<div class="speaker-name flex group cursor-pointer w-auto hover:bg-accent" on:click={handleClick}>
		<Icon name="user" class="" />
		<span class="text-primary font-bold font-sans">{selectedVal ? selectedVal.name : ''}</span>
		<Icon name="dropdown-arrow" class="invisible group-hover:visible" />
	</div>
	<div class="speaker-time">{numberToTime(time)}</div>
	{#if isListOpen}
		<div
			class="absolute z-10 rounded-md bg-zinc-100 flex flex-col filter drop-shadow-lg "
			use:clickOutside
			on:outclick={() => {isListOpen = false;}}
		>
			<div class="p-1">
				<input
					placeholder={$_('speakerSelect.addNew')}
					bind:value={newSpeaker}
					on:keypress={(e) => handleKeypress(e, newSpeaker)}
				/>
				<button class="w-min hover:text-primary" on:click={() => handleNewSpeakerSave(newSpeaker, time)}
					>{$_('speakerSelect.save')}</button
				>
			</div>
			{#each names as speaker}
				<div
					class="hover:bg-accent {speaker.id == selectedVal.id
						? 'flex justify-between p-1 bg-info'
						: 'flex justify-between max-w-xs p-1'}"
				>
					{#if speaker.id === editSpeakerId}
						<input class="w-48 border-2" bind:value={editingValue} />
						<div class="flex">
							<button
								class="w-min hover:text-primary"
								on:click={() => {
									handleRenameAll(speaker);
								}}>{$_('speakerSelect.save')}</button
							>
						</div>
					{:else}
						<div
							on:click={() => {
								selectSpeaker(speaker.id);
								isListOpen = false;
							}}
							class="cursor-pointer inline w-48"
						>
							{speaker.name}
						</div>
						<div>
							<button class="w-min hover:text-primary" on:click={() => handleStartEdit(speaker)}
								>{$_('speakerSelect.edit')}</button
							>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	<div use:editable class="content editable" />
</NodeViewWrapper>

<style>
	:global(.speaker) {
		display: grid;
		grid-template-columns: minmax(auto, 150px) auto;
		grid-template-rows: min-content auto;
		width: auto;
		grid-column-gap: 1px;
		margin-bottom: 10px;
	}

	@media only screen and (min-width: 1024px) {
		:global(.speaker) {
			grid-template-columns: minmax(150px, 250px) auto;
		}
	}

	.speaker-name {
		grid-row-start: 2;
		grid-column-start: 1;
		justify-self: end;
		height: max-content;
	}

	.speaker-time {
		grid-row-start: 1;
		grid-column-start: 2;
		font-size: small;
		color: rgba(156, 163, 175);
	}

	:global(.speaker) > .content {
		grid-row-start: 2;
		grid-column-start: 2;
	}
</style>
