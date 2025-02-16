<!-- @migration-task Error while migrating Svelte code: `<div>` cannot be a child of `<tbody>`. `<tbody>` only allows these children: `<tr>`, `<style>`, `<script>`, `<template>`. The browser will 'repair' the HTML (by moving, removing, or inserting elements) which breaks Svelte's assumptions about the structure of your components.
https://svelte.dev/e/node_invalid_placement -->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { languageAnnotationOptions } from '$lib/stores.svelte';

	let newLabel = '';
	let newDesc = '';
	let newActive = false;
	$: validated = newLabel.length > 1;

	const setActive = (element, label) => {
		console.log(element.target.checked);
		languageAnnotationOptions.update((l) =>
			l.map((x) => {
				if (x.label === label)
					return { label: x.label, description: x.description, active: element.target.checked };
				else return x;
			})
		);
	};
	const addNew = () => {
		languageAnnotationOptions.update((l) => {
			l.push({
				label: newLabel,
				description: newDesc,
				active: newActive
			});
			return l;
		});
        newLabel = "";
        newDesc = "";
        newActive = false;
	};
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
					<th />
					<th>{$_('editor.languageCode')}</th>
					<th>{$_('editor.languageDescription')}</th>
					<th>{$_('editor.languageActivate')}</th>
					<th>{$_('editor.languageAction')}</th>
				</tr>
			</thead>
			<tbody>
				{#each $languageAnnotationOptions as lang, index}
					<tr>
						<th>{index + 1}</th>
						<td>{lang.label}</td>
						<td>{lang.description}</td>
						<td class="" on:click={(e) => setActive(e, lang.label)}>
							<input type="checkbox" bind:checked={lang.active} />
						</td>
						<td>
							<button class="btn btn-ghost">{$_('editor.edit')}</button>
						</td>
					</tr>
				{/each}
				<tr>
					<th />
					<td><input bind:value={newLabel} type="text" class="max-w-[3rem]" /></td>
					<td><input bind:value={newDesc} type="text" /></td>
					<td><input bind:value={newActive} type="checkbox" /></td>
					<td
						><button on:click={addNew}
							class="btn {!validated ? 'btn-disabled' : 'btn-primary'} ">{$_('editor.addNew')}</button
						></td
					>
				</tr>
				<div class="modal-action">
					<label for="languages-modal" class="btn">{$_('editor.save')}</label>
				</div>
			</tbody>
		</table>
	</div>
</div>
