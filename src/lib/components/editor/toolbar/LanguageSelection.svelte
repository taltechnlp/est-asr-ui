<!-- @migration-task Error while migrating Svelte code: `<div>` cannot be a child of `<tbody>`. `<tbody>` only allows these children: `<tr>`, `<style>`, `<script>`, `<template>`. The browser will 'repair' the HTML (by moving, removing, or inserting elements) which breaks Svelte's assumptions about the structure of your components.
https://svelte.dev/e/node_invalid_placement -->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	// import { languageAnnotationOptions } from '$lib/stores.svelte';

	export let languageAnnotationOptions = [];
	export let onSetActive; // Callback prop
	export let onSave; // Callback prop

	let newLabel = '';
	let newDesc = '';
	let newActive = false;
	//let validated = false;

	$: validated = newLabel && newDesc;

	function setActive(event, label) {
		if (onSetActive) {
		onSetActive(label); // Call the callback
		}
	}

	function addNew() {
		if (validated) {
		languageAnnotationOptions = [
			...languageAnnotationOptions,
			{ label: newLabel, description: newDesc, active: newActive },
		];
		newLabel = '';
		newDesc = '';
		newActive = false;
		}
	}

	function save() {
		if (onSave) {
		onSave(languageAnnotationOptions); // Call the callback
		}
	}
</script>

<input type="checkbox" id="languages-modal" class="modal-toggle" />
<div class="modal">
	<div class="modal-box" style="max-width: 50rem">
		<h3 class="font-bold text-lg">{$_('editor.languageSelectionHeading')}</h3>
		<p class="py-4">
			{$_('editor.languageSelectionDescription')}
		</p>
		<table class="table max-w-screen-2xl">
			<thead>
				<tr>
				  <th>#</th>
				  <th>{$_('editor.label')}</th>
				  <th>{$_('editor.description')}</th>
				  <th>{$_('editor.active')}</th>
				  <th>{$_('editor.actions')}</th>
				</tr>
			  </thead>
			  <tbody>
				{#each languageAnnotationOptions as lang, index (lang.label)}
				  <tr>
					<th>{index + 1}</th>
					<td>{lang.label}</td>
					<td>{lang.description}</td>
					<td class="text-center" on:click={(e) => setActive(e, lang.label)}>
					  <input type="checkbox" checked={lang.active} on:change={() => {
						lang.active = !lang.active;
						languageAnnotationOptions = languageAnnotationOptions;
					  }} />
					</td>
					<td>
					  <button class="btn btn-ghost">{$_('editor.edit')}</button>
					</td>
				  </tr>
				{/each}
				<tr>
					<th></th>
				  <td>
					<input bind:value={newLabel} type="text" class="input input-bordered input-sm max-w-[5rem]" />
				  </td>
				  <td>
					<input bind:value={newDesc} type="text" class="input input-bordered input-sm" />
				  </td>
				  <td class="text-center">
					<input bind:checked={newActive} type="checkbox" class="checkbox" />
				  </td>
				  <td>
					<button on:click={addNew} class="btn btn-sm" disabled={!validated}>
					  {$_('editor.addNew')}
					</button>
				  </td>
				</tr>
			  </tbody>
		</table>
	</div>
</div>
