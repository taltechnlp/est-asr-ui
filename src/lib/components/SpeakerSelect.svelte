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

	let speakers = [
		{ selected: false, label: 'Ain Aas', editing: false },
		{ selected: true, label: 'Peeter Uuslinn', editing: false },
		{ selected: false, label: 'Johanna Jobs', editing: false },
		{ selected: false, label: 'Uus President', editing: false },
		{ selected: false, label: 'Vana Peaminister', editing: false }
	];
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
	let newSpeaker = '';

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
						console.log('aeg ', startTime);
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
	};

	const handleNewSpeakerSave = (name) => {
		console.log('saving ', name);
		if (name.length > 0) {
			/* speakers.push({selected: true, label: newSpeaker, editing: false}) */
			selectedValue = name;
			updateAttributes({ 'data-name': name });
			newSpeaker = '';
		}
		handleClick();
	};

	const handleSave = (speaker) => {
		if (speaker.selected === true) {
			selectedValue = speaker.label;
		}
	};

	const handleKeypress = (e, name) => {
		if (e.charCode === 13) handleNewSpeakerSave(name);
	};

/* 	const handleClickOutside = (e) => { isListOpen = false}; */

	const selectSpeaker = (name) => {
		selectedValue = name;
		updateAttributes({ 'data-name': name });
		/* speakers = speakers.map(x =>{
            if (x.label === selection) return {selected: true, label: x.label, editing: false}
            else return {selected: false, label: x.label, editing: false}
        }) */
	};

	const numberToTime = (number) => {
        if (number && number.start) {

            const nr = parseFloat(number.start)
            console.log("nr", nr)
            const time = new Date(0);
            time.setSeconds(nr);
            return nr < 60 ? time.toISOString().substr(14, 5) : time.toISOString().substr(11, 8);
        } else return ""
	};
</script>

<NodeViewWrapper class="svelte-component speaker {selected}">
	<div
		class="speaker-name flex group cursor-pointer w-auto hover:bg-blue-200"
		on:click={handleClick}
	>
		<Icon name="user" class="" />
		<span class="text-indigo-700 font-bold font-sans">{selectedValue}</span>
		<Icon name="delete" class="invisible group-hover:visible" />
	</div>
	<div class="speaker-time">{numberToTime(time)}</div>
	{#if isListOpen}
		<div
            class="absolute z-10 rounded-md bg-white flex flex-col filter drop-shadow-lg "
			use:clickOutside on:outclick={() => (isListOpen = false)}
		>
			<div class="p-1">
				<input
					placeholder="Lisa uus kõneleja"
					bind:value={newSpeaker}
					on:keypress={(e) => handleKeypress(e, newSpeaker)}
				/>
				<button on:click={() => handleNewSpeakerSave(newSpeaker)}>Save</button>
			</div>
			{#each getSpeakerNames() as speaker}
				<div
					class={speaker == selectedValue
						? 'flex justify-between p-1 bg-blue-200'
						: 'flex justify-between max-w-xs p-1'}
				>
					{#if speaker == 'Raul'}
						<input class="w-48 border-2" bind:value={speaker} />
						<div class="flex">
							<button
								on:click={() => {
									/* speaker.editing=false; */ handleSave(speaker);
								}}>Save</button
							>
						</div>
					{:else}
						<div
							on:click={() => {
								/* selectedValue = speaker.label */ selectSpeaker(speaker);
								isListOpen = false;
							}}
							class="cursor-pointer hover:bg-blue-400 inline w-48"
						>
							{speaker}
						</div>
						<div>
							<button on:click={() => {}}>Edit</button>
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

    @media only screen and (min-width: 1024px)  {
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