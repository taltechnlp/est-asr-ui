<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { toTime } from './helpers';
	import { browser } from '$app/environment';
	import type { ActionResult } from '@sveltejs/kit';
	import { applyAction, deserialize } from '$app/forms';
	import type { PageProps } from './$types';
	let {  form, data }: PageProps = $props();

	let error = $state('');
	let loading = $state(false);
	let upload: null | FileList = $state(null); 
	let languageChoices = [
		{ id: 0, text: 'estonian' },
		{ id: 1, text: 'finnish' }
	];
	let selectedLanguage = $state(languageChoices[0]);
	let notify = $state(true);

	let delFileId;
	const delFile = async (fileId) => {
		const response = await fetch('/api/files/' + fileId, {
			method: 'DELETE'
		}).catch(e => console.error("Failed to delete file", fileId));
		(document.getElementById('del-file-modal') as HTMLInputElement).checked = false;
		if (!response) {
			return;
		}
		if (!response.ok) {
			console.log('Server error');
		} else {
			await invalidateAll();
		}
		return;
	};

	const printError = (errorText) => {
		if (errorText === 'fileSizeLimit') {
			return $_('files.fileSizeLimit');
		} 
		else if (errorText === 'fileTooLong') {
			return $_('files.fileTooLong');
		}
		else if (errorText === 'noFile') {
			return $_('files.noFile');
		}
		else if (errorText === 'fileSaveFailed') {
			return $_('files.fileSaveFailed');
		}
		else if (errorText === 'finnishUploadFailed') {
			return $_('files.finnishUploadFailed');
		}
		else if (errorText === 'invalidLang') {
			return $_('files.invalidLang');
		}
		else {
			return $_('files.uploadError');
		}
	};

	async function uploadFile(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement}) {
		event.preventDefault();
		error = '';
		
		// Get the form element
		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		
		// Add additional form data
		formData.append('notify', notify ? "yes" : "no");
		formData.append('lang', selectedLanguage.text);
		
		loading = true;
		const response = await fetch(form.action, {
			method: 'POST',
			body: formData
		});
		const result: ActionResult = deserialize(await response.text());
		// console.log('Upload result', result);
		if (result.type === 'success') {
			// rerun all `load` functions, following the successful update
			await invalidateAll();
			loading = false;
			uploadModal.close();
			applyAction(result);
		}

		if (result.type === 'error') {
			loading = false;
			error = result.error;
			console.log('Upload failed', result.error);
			applyAction(result);
		}
		if (result.type === 'failure') {
			loading = false;
			console.log('Upload failed', result.data);
			if (result.data.uploadLimit) {
				error = 'fileSizeLimit';
			}
			else if (result.data.fileTooLong) {
				error = 'fileTooLong';
			}
			else if (result.data.fileSaveFailed) {
				error = 'fileSaveFailed';
			}
			else if (result.data.noFile) {
				error = 'noFile';
				console.log('Unexpected uploaderror', result.data);
			}
			else if (result.data.finnishUploadFailed) {
				error = 'finnishUploadFailed';
			}
			applyAction(result);
		}
		if (result.type === 'redirect') {
			loading = false;
			error = '';
			uploadModal.close();
			goto(result.location);
		}

		await awaitTimeout(10000).then(() =>
			{if (donePolling) longPolling();}
		);
	};

	function openFile(fileId, fileState, isOld) {
		if (isOld) {
			window.location.href = `https://tekstiks.ee/files/`;
		}
		else if (fileState == 'READY') {
			goto(`/files/${fileId}`);
		}
	}
	let donePolling;
	const awaitTimeout = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
	const longPolling = async () => {
		donePolling = false;
		if (!data.files.find((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')) {
			donePolling = true;
		}
		do {
			await awaitTimeout(10000);
			await invalidateAll();
		} while (!donePolling);
	};
	if (browser) {
		onMount(longPolling)
	}

	let uploadModal: HTMLDialogElement;

	onDestroy(() => {
		if (!donePolling) {
			donePolling = true;
		}
	});
</script>

<svelte:head>
	<title>{$_('files.title')}</title>
</svelte:head>
{#if false}
<div role="alert" class="alert alert-error mx-auto max-w-7xl">
	<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
	  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
	</svg>
	<span>{$_('files.hardwareFailureWarning')}</span>
</div>
{/if}
<div class="grid w-full min-h-[100dvh] justify-center content-start grid-cols-[minmax(320px,_1280px)] overflow-x-auto bg-base-100">
	<div class="flex justify-end max-w-screen-2xl">
		<button class="btn btn-primary gap-2 mt-5 mb-2 modal-button right" onclick={() => eval(`upload_modal.showModal()`)}>
			{$_('files.uploadButton')}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				id="Outline"
				viewBox="0 0 24 24"
				fill="#fff"
				class="h-4 w-4"
				aria-label={$_('files.uploadIcon')}
				><path
					d="M11.007,2.578,11,18.016a1,1,0,0,0,1,1h0a1,1,0,0,0,1-1l.007-15.421,2.912,2.913a1,1,0,0,0,1.414,0h0a1,1,0,0,0,0-1.414L14.122.879a3,3,0,0,0-4.244,0L6.667,4.091a1,1,0,0,0,0,1.414h0a1,1,0,0,0,1.414,0Z"
				/><path
					d="M22,17v4a1,1,0,0,1-1,1H3a1,1,0,0,1-1-1V17a1,1,0,0,0-1-1H1a1,1,0,0,0-1,1v4a3,3,0,0,0,3,3H21a3,3,0,0,0,3-3V17a1,1,0,0,0-1-1h0A1,1,0,0,0,22,17Z"
				/></svg
			>
		</button>
	</div>
	<table class="table table-compact max-w-screen-2xl">
		<thead>
			<tr>
				<th></th>
				<th>{$_('files.filename')}</th>
				<th>{$_('files.status')}</th>
				<th>{$_('files.uploadedAt')}</th>
				<th>{$_('files.actions')}</th>
			</tr>
		</thead>
		<tbody>
			{#if data.files && data.files.length > 0}
				{#each data.files as file, index}
					<tr
						class="{file.state == 'READY' ? 'cursor-pointer' : ''} hover"
						onclick={() => openFile(file.id, file.state, file.oldSystem)}
					>
						<th>{index + 1}</th>
						<td class="">
							<p class="break-words whitespace-normal">
								{file.filename}
							</p>
						</td>
						<td>
							{#if file.oldSystem}
							<div class="badge badge-md badge-info pl-2 pr-2">{$_('files.statusOld')}</div>
							{:else if file.state == 'READY'}
								<div class="badge badge-md badge-success pl-2 pr-2">{$_('files.statusReady')}</div>
							{:else if file.state == 'PROCESSING_ERROR'}
								<div class="badge badge-md badge-error pl-2 pr-2">{$_('files.statusError')}</div>
							{:else if file.state == 'PROCESSING'}
								<div class="badge badge-md badge-accent pl-2 pr-2">
									{$_('files.statusProcessing')} 
								</div>
								{#if file.progress >= 0}
									{` ${file.progress}%`}
								{/if}
								<span class="btn btn-ghost btn-xs" aria-label={$_('files.loading')}></span>
								<span class="loading loading-spinner loading-xs"></span>
							{:else if file.state == 'UPLOADED' && file.queued}
								<div class="badge badge-md badge-info pl-2 pr-2">{$_('files.statusUploaded')}</div>
								<span class="loading loading-spinner loading-xs"></span>
							{:else if file.state == 'UPLOADED'}
								<div class="badge badge-md badge-info pl-2 pr-2">{$_('files.statusUploaded')}</div>
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
						</td>
						<td class="">
							{toTime(file.uploadedAt)}
						</td>
						<td class="">
							{#if file.oldSystem}
							    <a href="https://tekstiks.ee/files">
									<button class="btn btn-outline btn-xs">{$_('files.toOldSystem')}</button>
								</a>
							{:else if file.state == 'READY'}
								<button class="btn btn-outline btn-xs">{$_('files.openButton')}</button>
							{/if}
							
							<button
								class="btn btn-outline btn-xs"
								onclick={(e) => {
									delFileId = file.id;
									e.stopPropagation();
									(document.getElementById('del-file-modal') as HTMLInputElement).checked = true;
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										delFileId = file.id;
										e.stopPropagation();
										(document.getElementById('del-file-modal') as HTMLInputElement).checked = true;
									}
								}}
								>{$_('files.deleteButton')}</button>
						</td>
					</tr>
				{/each}
			{:else if error}
				<tr><td colspan="5" class="text-center">{error}</td></tr>
			{:else}
				<tr><td colspan="5" class="text-center">{$_('files.noFiles')}</td></tr>
			{/if}
		</tbody>
	</table>

	<dialog id="upload_modal" class="modal cursor-pointer modal-bottom sm:modal-middle" bind:this={uploadModal}>
		<div class="modal-box relative">
			<h3 class="text-lg font-bold mb-4">{$_('files.uploadHeader')}</h3>
			<form method="dialog">
				<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" aria-label={$_('files.close')}>✕</button>
			  </form>
			<form method="POST" enctype="multipart/form-data" onsubmit={uploadFile}>
				<fieldset disabled={loading} aria-busy={loading} class="fieldset w-full bg-base-200 border border-base-300 p-4 rounded-box">
					{#if form?.uploadLimit}<p class="error">File is too large!</p>{/if}
					{#if form?.fileTooLong}<p class="error">File is too long!</p>{/if}
					<label class="form-control w-full max-w-xs">
						<div class="label">
							<span class="label-text">{$_('files.language')}</span>
						</div>
						<select
							id="langSelect"
							required
							bind:value={selectedLanguage}
							class="select select-bordered w-full max-w-xs mb-4"
						>
							{#each languageChoices as language}
								<option value={language}>
									{$_(`files.languageChoices.${language.text}`)}
								</option>
							{/each}
						</select>
					</label>
					<label class="form-control w-full max-w-xs mb-4">
						<div class="label">
							<span class="label-text">{$_('files.file')}</span>
						</div>
						<input
							class="file-input file-input-bordered file-input-primary w-full max-w-xs"
							type="file"
							bind:files={upload}
							accept="audio/*,video/*,audio/wav,audio/x-wav,audio/mp3,audio/mpeg,audio/ogg,video/ogg,video/x-mpeg2,video/mpeg2,audio/x-m4a,audio/flac,audio/x-flac,audio/x-amr,audio/amr"
							id="file"
							name="file"
							lang={data.language}
							placeholder=""
							required
						/>
					</label>
					<div class="form-control flex-row">
						<label class="label cursor-pointer">
							<input type="checkbox" id="notify" bind:checked={notify} class="checkbox mr-4" />
							<span class="label-text">{$_('files.uploadNotify')}</span>
						</label>
					</div>
				</fieldset>
				<fieldset class="fieldset w-md bg-base-200 border border-base-300 p-4 rounded-box mb-4">
					<legend class="fieldset-legend">{$_('files.requirements')}</legend>
					<ul class="list-disc list-inside">
						<li class="py-4">{$_('files.supportedFormats')}</li>
						<li class="py-4 pt-0">{$_('files.fileSizeLimit')}</li>
						<li class="py-4 pt-0">{$_('files.fileDurationLimit')}</li>
					</ul>
				</fieldset>
					{#if error}
						<p class="mt-3 mb-3 text-red-500 text-center font-semibold">{printError(error)}</p>
					{/if}
					{#if form?.uploadLimit}
						<p class="mt-3 mb-3 text-red-500 text-center font-semibold">{printError("fileTooLong")}</p>
					{/if}
					{#if loading}
						<button class="btn" disabled aria-label={$_('files.uploadButton')}
							><span class="btn btn-ghost btn-xs loading" aria-label={$_('files.loading')}></span></button
						>
					{:else if upload}
						<button type="submit" class="btn btn-active btn-primary" aria-label={$_('files.uploadButton')}
							>{$_('files.uploadButton')}</button
						>
					{:else}
						<button class="btn" disabled>{$_('files.uploadButton')}</button>
					{/if}
				</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label={$_('files.close')}>close</button>
		</form>
	</dialog>

	<input type="checkbox" id="del-file-modal" class="modal-toggle" />
	<label for="del-file-modal" class="modal cursor-pointer">
		<label class="modal-box relative" for="">
			<h3 class="font-bold text-lg">{$_('files.fileDeletion')}</h3>
			<p class="py-4">
				{$_('files.fileDeletionWarning')}
			</p>
			<div class="modal-action">
				<button type="button" class="btn btn-outline" onclick={() => (document.getElementById('del-file-modal') as HTMLInputElement).checked = false}>{$_('files.cancel')}</button>
				<button type="button" class="btn" onclick={() => delFile(delFileId)} onkeydown={(e) => e.key === 'Enter' && delFile(delFileId)}
					>{$_('files.delete')}</button>
			</div>
		</label>
	</label>
</div>

<style>
</style>
