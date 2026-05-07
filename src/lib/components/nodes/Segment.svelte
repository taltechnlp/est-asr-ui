<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '../Icon.svelte';
	import { clickOutside } from '../clickOutside';
	import type { Speaker } from '$lib/helpers/converters/types';
	import { v4 as uuidv4 } from 'uuid';

	import {
		speakerNames,
		addSpeakerBlock,
		editorMounted,
		editorMode,
		fontSize as fontSizeStore
	} from '$lib/stores.svelte';
	import { /* findParentNodeOfTypeClosestToPos, */ findBlockNodes } from 'prosemirror-utils';
	// import { Transform } from 'prosemirror-transform';

	import { _ } from 'svelte-i18n';
	interface Props {
		node: NodeViewProps['node'];
		decorations: NodeViewProps['decorations'];
		extension: NodeViewProps['extension'];
		updateAttributes: NodeViewProps['updateAttributes'];
		deleteNode: NodeViewProps['deleteNode'];
		editor: NodeViewProps['editor'];
		getPos: NodeViewProps['getPos'];
		selected?: NodeViewProps['selected'];
	}

	let {
		node = $bindable(),
		decorations,
		extension,
		updateAttributes,
		deleteNode,
		editor,
		getPos,
		selected = false
	}: Props = $props();

	type Name = {
		name: string;
		id: string;
	};

	let isListOpen = $state(false);
	let initialName = node.attrs['data-name'];
	let initialId = node.attrs['id'];
	let topic = $state(node.attrs['topic']);
	let selectedVal: Name = $state({
		name: node.attrs['data-name'],
		id: node.attrs['id']
	});
	let newSpeaker = $state('');
	let editSpeakerId = $state('');
	let editingValue = $state('');
	let names: Array<Speaker> = $state([]);
	let newSpeakerInputEl: HTMLInputElement | null = $state(null);
	let editInputEl: HTMLInputElement | null = $state(null);
	let summaryEl: HTMLElement | null = $state(null);
	const newSpeakerInputId = `speaker-new-${uuidv4().substring(32 - 8)}`;
	speakerNames.subscribe((ns) => {
		// Update dropdown list where for each id one name is shown only
		names = ns.reduce((acc, curr) => {
			if (acc.find((x) => x.id === curr.id)) return acc;
			else {
				acc.push(curr);
				return acc;
			}
		}, [] as Array<Speaker>);
		// Update selected name of each component instance
		// Check id defined b.c. update might happen before transaction has finished
		if (node && node.attrs['data-name'] && node.attrs['id']) {
			selectedVal = {
				name: node.attrs['data-name'],
				id: node.attrs['id']
			};
		}
	});

	const findTimeStamps = (startPos, state) => {
		let i = 0;
		let done = false;
		let startTime = null;
		let testNode;
		do {
			testNode = state.doc.nodeAt(startPos + i);
			if (testNode && testNode.marks && testNode.marks.length > 0) {
				for (let j = 0; j < testNode.marks.length; j++) {
					// @ts-ignore
					if (testNode.marks[0].attrs.start) {
						// @ts-ignore
						startTime = testNode.marks[0].attrs.start;
						done = true;
						break;
					}
				}
			}
			if (done) break;
			i++;
		} while (!done && testNode);

		return startTime;
	};
	let cssVarStyles = $derived(`font-size:${$fontSizeStore}px`)
	let time = $derived(findTimeStamps(getPos() + 1, editor.state));


	const handleClick = () => {
		isListOpen ? (isListOpen = false) : (isListOpen = true);
		if (!isListOpen) {
			newSpeaker = '';
			editSpeakerId = '';
			editingValue = '';
		}
	};

	const closePopover = () => {
		if (!isListOpen) return;
		isListOpen = false;
		newSpeaker = '';
		editSpeakerId = '';
		editingValue = '';
		summaryEl?.focus();
	};

	const handlePopoverKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.stopPropagation();
			if (editSpeakerId) {
				editSpeakerId = '';
				editingValue = '';
			} else {
				closePopover();
			}
		}
	};

	$effect(() => {
		if (isListOpen) {
			queueMicrotask(() => newSpeakerInputEl?.focus());
		}
	});

	$effect(() => {
		if (editSpeakerId) {
			queueMicrotask(() => {
				editInputEl?.focus();
				editInputEl?.select();
			});
		}
	});
	const getStartTime = (node) => {
		return node.content.content &&
			node.content.content[0] &&
			node.content.content[0].marks &&
			node.content.content[0].marks[0] &&
			node.content.content[0].marks[0].attrs &&
			node.content.content[0].marks[0].attrs.start
			? node.content.content[0].marks[0].attrs.start
			: -1;
	};
	const getEndTime = (node) => {
		return node.content.content &&
			node.content.content[node.content.content.length-1] &&
			node.content.content[node.content.content.length-1].marks &&
			node.content.content[node.content.content.length-1].marks[0] &&
			node.content.content[node.content.content.length-1].marks[0].attrs &&
			node.content.content[node.content.content.length-1].marks[0].attrs.end
			? node.content.content[node.content.content.length-1].marks[0].attrs.end
			: -1;
	};
	const handleNewSpeakerSave = (newName, start) => {
		if (newName.length > 0) {
			let newId;
			const blockNodesWithPos = findBlockNodes(editor.state.doc, false);
			const exists = blockNodesWithPos.find((el) => el.node.attrs['data-name'] === newName);
			if (!exists) {
				newId = uuidv4().substring(32 - 12);
			}
			// Change node attribute transaction
			let tr = editor.state.tr;
			tr.setNodeAttribute(getPos(), 'data-name', newName);
			tr.setNodeAttribute(getPos(), 'id', newId);
			let newState = editor.state.apply(tr);
			const updatedBlockNodesWithPos = findBlockNodes(newState.doc, false);
			// Update store
			const newSpeakers = updatedBlockNodesWithPos.map((el) => {
				return {
					name: el.node.attrs['data-name'],
					id: el.node.attrs.id,
					start: getStartTime(el.node),
					end: getEndTime(el.node)
				};
			});
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
		const exists = blockNodesWithPos.find((el) => el.node.attrs.id === id);
		if (!exists) {
			return;
		}
		// Change node attribute transaction
		let tr = editor.state.tr;
		tr.setNodeAttribute(getPos(), 'data-name', exists.node.attrs['data-name']);
		tr.setNodeAttribute(getPos(), 'id', id);
		let newState = editor.state.apply(tr);
		const updatedBlockNodesWithPos = findBlockNodes(newState.doc, false);
		// Update store
		const newSpeakers = updatedBlockNodesWithPos.map((el) => {
			return {
				name: el.node.attrs['data-name'],
				id: el.node.attrs.id,
				start: getStartTime(el.node),
				end: getEndTime(el.node)
			};
		});
		editor.view.updateState(newState);
		speakerNames.set(newSpeakers);
		selectedVal = {
			name: exists.node.attrs['data-name'],
			id: exists.node.attrs.id
		};
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
		const name = speaker.name;
		let tr = editor.state.tr;
		const blockNodesWithPos = findBlockNodes(editor.state.doc, false);
		blockNodesWithPos.forEach((el) =>
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
			speakers = speakers.map((s) => {
				if (s.id === speaker.id) {
					return {
						id: s.id,
						name: editingValue,
						start: s.start,
						end: s.end
					};
				} else return s;
			});
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

	const saveTopic = (e) => updateAttributes({ topic });

	onMount(async () => {
		// Update speakers store when after initial editor load speaker is added
		if ($editorMounted) {
			// Cannot use the node passed into this component here (bug or timing issue). Getting by pos works.
			// This also works const parentNode = findParentNodeOfTypeClosestToPos(editor.state.doc.resolve(getPos()+1), editor.schema.nodes.speaker);
			const actualNode = editor.state.doc.nodeAt(getPos());
			const id = addSpeakerBlock(selectedVal.name, getStartTime(actualNode), getEndTime(actualNode));
		}
	});

	onDestroy(async () => {
		if ($editorMounted) {
			speakerNames.update((sps) =>
				sps.filter((s) => !(s.id === selectedVal.id && s.start === time))
			);
		}
	});
</script>

<NodeViewWrapper class="svelte-component speaker {selected}">
	<div class="top-container flex">
		<details class="dropdown speaker-name-container" bind:open={isListOpen} contentEditable={false}>
			<summary
				class="m-1 speaker-name flex group cursor-pointer w-auto hover:bg-accent"
				bind:this={summaryEl}
				aria-haspopup="dialog"
				aria-expanded={isListOpen}
			>
				<Icon name="user" class="" />
				<span class="text-primary font-bold font-sans">{selectedVal.name}</span>
				<Icon name="dropdown-arrow" class="invisible group-hover:visible" />
			</summary>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="speaker-popover absolute z-10 mt-1 w-72 bg-base-100 border border-base-300 rounded-md shadow-lg"
				role="dialog"
				tabindex="-1"
				aria-label={$_('speakerSelect.addNew')}
				use:clickOutside={() => closePopover()}
				onkeydown={handlePopoverKeydown}
			>
				<div class="p-3 border-b border-base-300">
					<label for={newSpeakerInputId} class="block text-xs font-semibold text-gray-600 mb-1">
						{$_('speakerSelect.addNew')}
					</label>
					<input
						id={newSpeakerInputId}
						class="input input-bordered input-sm w-full"
						placeholder={$_('speakerSelect.addNew')}
						bind:value={newSpeaker}
						bind:this={newSpeakerInputEl}
						onkeypress={(e) => handleKeypress(e, newSpeaker)}
					/>
					<div class="flex justify-end mt-2">
						<button
							class="btn btn-primary btn-xs"
							onclick={() => handleNewSpeakerSave(newSpeaker, time)}
							disabled={!newSpeaker.trim()}
						>
							{$_('speakerSelect.save')}
						</button>
					</div>
				</div>
				<ul class="p-1 max-h-60 overflow-y-auto" role="menu">
					{#each names as speaker}
						<li role="none" class="rounded-md {speaker.id == selectedVal.id ? 'bg-info/30' : ''}">
							{#if speaker.id === editSpeakerId}
								<div class="p-2 space-y-2">
									<input
										class="input input-bordered input-sm w-full"
										bind:value={editingValue}
										bind:this={editInputEl}
										onkeypress={(e) => {
											if (e.charCode === 13) handleRenameAll(speaker);
										}}
									/>
									<div class="flex justify-end">
										<button
											class="btn btn-primary btn-xs"
											onclick={() => handleRenameAll(speaker)}
											disabled={!editingValue.trim()}
										>
											{$_('speakerSelect.save')}
										</button>
									</div>
								</div>
							{:else}
								<div class="flex items-center justify-between gap-2 p-1 hover:bg-accent rounded-md">
									<button
										role="menuitem"
										onclick={() => {
											selectSpeaker(speaker.id);
											closePopover();
										}}
										class="flex-grow text-left truncate cursor-pointer px-1"
									>
										{speaker.name}
									</button>
									<button
										class="btn btn-xs btn-ghost flex-shrink-0 hover:text-primary"
										onclick={() => handleStartEdit(speaker)}
									>
										{$_('speakerSelect.edit')}
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</details>
		<div class="flex items-center speaker-time-container" contentEditable={false} >
			<p class="speaker-time">{numberToTime(time)}</p>
			{#if $editorMode === 2}
				<input
					type="text"
					name="topic"
					id=""
					placeholder={$_('speakerSelect.topicPlaceholder')}
					class="input input-accent input-xs w-full max-w-xs ml-5"
					bind:value={topic}
					onblur={saveTopic}
				/>
			{/if}
		</div>
	</div>
	<NodeViewContent class="content editable" style={cssVarStyles}></NodeViewContent>
</NodeViewWrapper>

<style>
	:global(.speaker) {
		display: grid;
		grid-template-columns: auto;
		grid-template-rows: min-content auto;
		width: auto;
		grid-column-gap: 1px;
		margin-bottom: 10px;
	}

	.speaker-name-container {
		/* grid-row-start: 1;
		grid-column-start: 1; */
		justify-self: start;
		height: max-content;
		min-width: 50px;
	}
	.speaker-time {
		justify-self: start;
		font-size: small;
		color: rgba(156, 163, 175);
	}



</style>
