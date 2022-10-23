<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, editable } from 'svelte-tiptap';
	import { onMount, onDestroy } from 'svelte';
	import Icon from './Icon.svelte';
	import { clickOutside } from './clickOutside';
	import type { Speaker } from '$lib/helpers/converters/types';
	import {v4 as uuidv4} from "uuid";

	export let node: NodeViewProps['node'];
	export let decorations: NodeViewProps['decorations'];
	export let extension: NodeViewProps['extension'];
	export let updateAttributes: NodeViewProps['updateAttributes'];
	export let deleteNode: NodeViewProps['deleteNode'];
	export let editor: NodeViewProps['editor'];
	export let getPos: NodeViewProps['getPos'];
	export let selected: NodeViewProps['selected'] = false;
	import { speakerNames, addSpeakerName, editorMounted } from '$lib/stores';
	import { findParentNodeOfTypeClosestToPos,findBlockNodes } from 'prosemirror-utils';
	import { Transform } from 'prosemirror-transform';

	import { _ } from 'svelte-i18n';

	type Name = {
		name: string;
		id: string;
	}

	let isListOpen = false;
	let initialName = node.attrs['data-name'];
	let initialId = node.attrs['id'];
	let selectedVal: Name = {
		name: node.attrs['data-name'],
		id: node.attrs['id']
	}

	let newSpeaker = '';
	let editSpeakerId = '';
	let editingValue = '';
	let names 
	speakerNames.subscribe(ns => {
		// Update dropdown list where for each id one name is shown only
		names = ns.reduce((acc, curr) => {
			if (acc.find(x=>x.id===curr.id)) return acc;
			else {
				acc.push(curr)
				return acc;}
		}, ([] as Array<Speaker>));
		// Update selected name of each component instance
		// Check id defined b.c. update might happen before transaction has finished
		if (node.attrs['data-name'] && node.attrs['id']) {
			selectedVal = {
				name: node.attrs['data-name'],
				id: node.attrs['id']
			}
		}
	})
		
	speakerNames.subscribe(
		s=>{
			console.log(s, names)}
		)

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
	const getStartTime = (node) => {
			return node.content.content && node.content.content[0] && node.content.content[0].marks && node.content.content[0].marks[0].attrs.start
					? node.content.content[0].marks[0].attrs.start : -1
	}
	const handleNewSpeakerSave = (newName, start) => {
		if (newName.length > 0) {
			let newId;
			const blockNodesWithPos = findBlockNodes(editor.state.doc, false);
			const exists = blockNodesWithPos.find(el=>el.node.attrs['data-name']===newName)
			if (!exists) {
				newId = uuidv4().substring(32 - 12);
			}
			// Change node attribute transaction
			let tr = editor.state.tr
			tr.setNodeAttribute(getPos(), 'data-name', newName);
			tr.setNodeAttribute(getPos(), 'id', newId);
			let newState = editor.state.apply(tr);
			const updatedBlockNodesWithPos = findBlockNodes(newState.doc, false);
			// Update store  
			const newSpeakers = updatedBlockNodesWithPos.map(el => {
				return {
					name: el.node.attrs['data-name'],
					id: el.node.attrs.id,
					start: getStartTime(el.node)
				}
			})
			editor.view.updateState(newState); 
			speakerNames.set(newSpeakers);
			newSpeaker = '';
		}
		handleClick();
	};

	const handleKeypress = (e, name) => {
		if (e.charCode === 13) handleNewSpeakerSave(name, time);
	};

	const selectSpeaker = (id) => {
		const blockNodesWithPos = findBlockNodes(editor.state.doc, false);
		const exists = blockNodesWithPos.find(el=>el.node.attrs.id===id)
		if (!exists) {
			return;
		}
		// Change node attribute transaction
		let tr = editor.state.tr
		tr.setNodeAttribute(getPos(), 'data-name', exists.node.attrs['data-name']);
		tr.setNodeAttribute(getPos(), 'id', id);
		let newState = editor.state.apply(tr);
		const updatedBlockNodesWithPos = findBlockNodes(newState.doc, false);
		// Update store  
		const newSpeakers = updatedBlockNodesWithPos.map(el => {
			return {
				name: el.node.attrs['data-name'],
				id: el.node.attrs.id,
				start: getStartTime(el.node)
			}
		})
		editor.view.updateState(newState); 
		speakerNames.set(newSpeakers);
		selectedVal = {
			name: exists.node.attrs['data-name'],
			id: exists.node.attrs.id
		}
		// TODO: reset store from nodes or remove old value.
		// TODO: change node id attr also
		updateAttributes({ 'data-name': selectedVal.name });
	};

	const handleStartEdit = (speaker) => {
		editSpeakerId = speaker.id;
		editingValue = speaker.name;
	};

	const handleRenameAll = (speaker) => {
		const speakerNodes = editor.view.state.doc.content;
		const name = speaker.name
		let tr = editor.state.tr
		const blockNodesWithPos = findBlockNodes(editor.state.doc, false)
		console.log(blockNodesWithPos);
		blockNodesWithPos.forEach(el =>
			// @ts-ignore
			{
				if (el.node.attrs['id'] === speaker.id) {
					tr.setNodeAttribute(el.pos, 'data-name', editingValue);
					}
				}
				);
		let newState = editor.state.apply(tr);
		editor.view.updateState(newState);
		speakerNames.update((speakers) => {
			speakers = speakers.map(s => {
				if (s.id===speaker.id) {
					return {
					id: s.id,
					name: editingValue,
					start: s.start
				}} else return s;
			})
			return speakers; 
		});
		isListOpen = false;
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
			const get = editor.state.doc.nodeAt(getPos()) // töötab
			const parentNode = findParentNodeOfTypeClosestToPos(editor.state.doc.resolve(getPos()+1), editor.schema.nodes.speaker);
			console.log('speaker', parentNode.node, parentNode.pos) // töötab
			console.log('node pos', getPos())
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
		<span class="text-primary font-bold font-sans">{selectedVal.name}</span>
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
