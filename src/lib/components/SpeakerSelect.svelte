<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, editable } from 'svelte-tiptap';
	import Icon from './Icon.svelte';
	import { clickOutside } from './clickOutside';

	export let node: NodeViewProps['node'];
	export let decorations: NodeViewProps['decorations'];
	export let extension: NodeViewProps['extension'];
	export let updateAttributes: NodeViewProps['updateAttributes'];
	export let deleteNode: NodeViewProps['deleteNode'];
	export let editor: NodeViewProps['editor'];
	export let getPos: NodeViewProps['getPos'];
	export let selected: NodeViewProps['selected'] = false;
	import { speakerNames, changeName, addName } from '$lib/stores';
	import { _ } from 'svelte-i18n';

	/* 
	Initialize component:
	 1. Find the id of the speaker name in the speakerNames store. This is required to allow renaming.
	 2. Show speaker name based on the id. Store id in local state.
	List closed: show currently selected value from local component state.
	List open: show all unique speaker names from all components from the editor DOM.
	Add new item:
	 1. Add item as currently selected value. Change local state and call updateAttributes to change DOM.
	 2. Update speakerNames store
	 3. Close list
	Edit item:
	 1. 
	*/

	const getSpeakerNames = () => {
		const speakerNodes = editor.view.state.doc.content;
		let speakerNames = new Set();
		speakerNodes.forEach((node) =>
			node.attrs['data-name'] ? speakerNames.add(node.attrs['data-name']) : null
		);
		return Array.from(speakerNames);
	};

	$: isListOpen = false;
	let selectedValue = node.attrs['data-name'];
	let selectedId;
	const setSelectedId = (selectedValue) => {
		const i = $speakerNames.findIndex((x) => x === selectedValue);
		if (i) selectedId = i;
	};
	setSelectedId(selectedValue);
	let newSpeaker = '';
	let editSpeakerId = -1;
	let editingValue = '';
	$: ids = $speakerNames.map((x, i) => i);

	const showSpeakerName = (id) => {
		const res = $speakerNames[id];
		if (res) return $speakerNames[id];
		else return selectedValue;
	};

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
			editSpeakerId = -1;
			editingValue = '';
		}
	};

	const handleNewSpeakerSave = (name) => {
		if (name.length > 0) {
			addName(name);
			setSelectedId(name);
			updateAttributes({ 'data-name': name });
			newSpeaker = '';
		}
		handleClick();
	};

	const handleKeypress = (e, name) => {
		if (e.charCode === 13) handleNewSpeakerSave(name);
	};

	/* 	const handleClickOutside = (e) => { isListOpen = false}; */

	const selectSpeaker = (id) => {
		selectedId = id;
		updateAttributes({ 'data-name': showSpeakerName(id) });
		/* speakers = speakers.map(x =>{
            if (x.label === selection) return {selected: true, label: x.label, editing: false}
            else return {selected: false, label: x.label, editing: false}
        }) */
	};

	const handleStartEdit = (speakerId) => {
		if (typeof speakerId == 'number') {
			editSpeakerId = speakerId;
			editingValue = showSpeakerName(speakerId);
		}
	};

	const handleSave = (speakerId) => {
		const speakerNodes = editor.view.state.doc.content;
		const name = showSpeakerName(speakerId);
		speakerNodes.forEach((node) =>
			// @ts-ignore
			node.attrs['data-name'] === name ? (node.attrs['data-name'] = editingValue) : null
		);
		changeName(speakerId, editingValue);
		selectedId = $speakerNames.findIndex((x) => x === editingValue);
		updateAttributes({ 'data-name': showSpeakerName(speakerId) });
		// updateAttributes({ 'data-name': editingValue });
		editingValue = '';
		editSpeakerId = -1;
	};

	const numberToTime = (number) => {
		if (number && number.start) {
			const nr = parseFloat(number.start);
			const time = new Date(0);
			time.setSeconds(nr);
			return nr < 60 ? time.toISOString().substr(14, 5) : time.toISOString().substr(11, 8);
		} else return '';
	};
</script>

<NodeViewWrapper class="svelte-component speaker {selected}">
	<div class="speaker-name flex group cursor-pointer w-auto hover:bg-accent" on:click={handleClick}>
		<Icon name="user" class="" />
		<span class="text-primary font-bold font-sans">{showSpeakerName(selectedId)}</span>
		<Icon name="dropdown-arrow" class="invisible group-hover:visible" />
	</div>
	<div class="speaker-time">{numberToTime(time)}</div>
	{#if isListOpen}
		<div
			class="absolute z-10 rounded-md bg-white flex flex-col filter drop-shadow-lg "
			use:clickOutside
			on:outclick={() => (isListOpen = false)}
		>
			<div class="p-1">
				<input
					placeholder={$_('speakerSelect.addNew')}
					bind:value={newSpeaker}
					on:keypress={(e) => handleKeypress(e, newSpeaker)}
				/>
				<button class="w-min hover:text-primary" on:click={() => handleNewSpeakerSave(newSpeaker)}
					>{$_('speakerSelect.save')}</button
				>
			</div>
			{#each ids as speakerId}
				<div
					class="hover:bg-accent {speakerId == selectedId
						? 'flex justify-between p-1 bg-info'
						: 'flex justify-between max-w-xs p-1'}"
				>
					{#if speakerId === editSpeakerId}
						<input class="w-48 border-2" bind:value={editingValue} />
						<div class="flex">
							<button
								class="w-min hover:text-primary"
								on:click={() => {
									/* speaker.editing=false; */ handleSave(speakerId);
								}}>{$_('speakerSelect.save')}</button
							>
						</div>
					{:else}
						<div
							on:click={() => {
								/* selectedValue = speaker.label */ selectSpeaker(speakerId);
								isListOpen = false;
							}}
							class="cursor-pointer inline w-48"
						>
							{showSpeakerName(speakerId)}
						</div>
						<div>
							<button class="w-min hover:text-primary" on:click={() => handleStartEdit(speakerId)}
								>{$_('speakerSelect.edit')}</button
							>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	<div on:click={() => console.log('test')} use:editable class="content editable" />
</NodeViewWrapper>

<style>
	:global(.speaker) {
		display: grid;
		grid-template-columns: 150px auto;
		grid-template-rows: min-content auto;
		width: auto;
		grid-column-gap: 10px;
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
