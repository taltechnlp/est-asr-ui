<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { toTime, toDateParts } from './helpers';
	import { browser } from '$app/environment';
	import type { ActionResult } from '@sveltejs/kit';
	import { applyAction, deserialize } from '$app/forms';
	import type { PageProps } from './$types';
	import StorageBar from '$lib/components/StorageBar.svelte';
	import FormatStrip from '$lib/components/FormatStrip.svelte';
	let { form, data }: PageProps = $props();

	let error = $state('');
	let loading = $state(false);
	let upload: null | FileList = $state(null);
	let languageChoices = [
		{ id: 0, text: 'estonian' },
		{ id: 1, text: 'finnish' }
	];
	let selectedLanguage = $state(languageChoices[0]);
	let notify = $state(true);

	let selectedFiles: Set<string> = $state(new Set());
	let selectAll = $derived(
		data.files && data.files.length > 0 && selectedFiles.size === data.files.length
	);
	let bulkDeleting = $state(false);

	// Only one file's format strip is open at a time — a list of open drawers is unreadable.
	let openFormatsFor: string | null = $state(null);

	function toggleFormats(fileId: string, event: Event) {
		event.stopPropagation();
		openFormatsFor = openFormatsFor === fileId ? null : fileId;
	}

	/** Leading rail state: quiet for finished files, coloured only for the exceptions. */
	function railClass(file) {
		if (file.oldSystem) return 'bg-base-300';
		if (file.state === 'PROCESSING_ERROR') return 'bg-error';
		if (file.state === 'PROCESSING') return 'bg-accent';
		if (file.state === 'UPLOADED') return 'bg-info';
		return 'bg-base-300';
	}

	function railFill(file) {
		if (file.state !== 'PROCESSING') return 100;
		return file.progress >= 0 ? Math.min(file.progress, 100) : 100;
	}

	let delFileId;
	const delFile = async (fileId) => {
		const response = await fetch('/api/files/' + fileId, {
			method: 'DELETE'
		}).catch((e) => console.error('Failed to delete file', fileId));
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

	function toggleSelectAll() {
		if (selectedFiles.size === data.files.length) {
			selectedFiles = new Set();
		} else {
			selectedFiles = new Set(data.files.map((f) => f.id));
		}
	}

	function toggleFileSelection(fileId: string, event: Event) {
		event.stopPropagation();
		const newSet = new Set(selectedFiles);
		if (newSet.has(fileId)) {
			newSet.delete(fileId);
		} else {
			newSet.add(fileId);
		}
		selectedFiles = newSet;
	}

	async function deleteSelectedFiles() {
		bulkDeleting = true;
		const fileIds = Array.from(selectedFiles);
		for (const fileId of fileIds) {
			await fetch('/api/files/' + fileId, { method: 'DELETE' }).catch((e) =>
				console.error('Failed to delete file', fileId, e)
			);
		}
		(document.getElementById('bulk-del-modal') as HTMLInputElement).checked = false;
		selectedFiles = new Set();
		bulkDeleting = false;
		await invalidateAll();
	}

	const printError = (errorText) => {
		if (errorText === 'fileSizeLimit') {
			return $_('files.fileSizeLimit');
		} else if (errorText === 'fileTooLong') {
			return $_('files.fileTooLong');
		} else if (errorText === 'noFile') {
			return $_('files.noFile');
		} else if (errorText === 'fileSaveFailed') {
			return $_('files.fileSaveFailed');
		} else if (errorText === 'finnishUploadFailed') {
			return $_('files.finnishUploadFailed');
		} else if (errorText === 'invalidLang') {
			return $_('files.invalidLang');
		} else if (errorText === 'storageLimitExceeded') {
			return $_('files.storageLimitExceeded');
		} else {
			return $_('files.uploadError');
		}
	};

	async function uploadFile(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
		event.preventDefault();
		error = '';

		// Get the form element
		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);

		// Client-side storage check disabled temporarily - allow exceeding limit
		// const fileInput = formData.get('file') as File;
		// if (fileInput && data.storage && BigInt(fileInput.size) > BigInt(data.storage.remaining)) {
		// 	error = 'storageLimitExceeded';
		// 	return;
		// }

		// Add additional form data
		formData.append('notify', notify ? 'yes' : 'no');
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
			} else if (result.data.fileTooLong) {
				error = 'fileTooLong';
			} else if (result.data.fileSaveFailed) {
				error = 'fileSaveFailed';
			} else if (result.data.noFile) {
				error = 'noFile';
				console.log('Unexpected uploaderror', result.data);
			} else if (result.data.finnishUploadFailed) {
				error = 'finnishUploadFailed';
			} else if (result.data.storageLimitExceeded) {
				error = 'storageLimitExceeded';
			}
			applyAction(result);
		}
		if (result.type === 'redirect') {
			loading = false;
			error = '';
			uploadModal.close();
			goto(result.location);
		}

		await awaitTimeout(10000).then(() => {
			if (donePolling) longPolling();
		});
	}

	function openFile(fileId, fileState, isOld) {
		if (isOld) {
			window.location.href = `https://tekstiks.ee/files/`;
		} else if (fileState == 'READY') {
			goto(`/files/${fileId}`);
		}
	}
	let donePolling = true;
	let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
	const awaitTimeout = (delay) =>
		new Promise<void>((resolve) => {
			pollingTimeout = setTimeout(() => {
				pollingTimeout = null;
				resolve();
			}, delay);
		});
	const shouldPoll = () =>
		data.files.some((file) => file.state === 'PROCESSING' || file.state === 'UPLOADED');

	const longPolling = async () => {
		donePolling = false;
		while (!donePolling && shouldPoll()) {
			await awaitTimeout(10000);
			if (donePolling) {
				break;
			}
			await invalidateAll();
		}
		donePolling = true;
	};
	if (browser) {
		onMount(() => {
			void longPolling();
		});
	}

	let uploadModal: HTMLDialogElement;

	onDestroy(() => {
		donePolling = true;
		if (pollingTimeout) {
			clearTimeout(pollingTimeout);
			pollingTimeout = null;
		}
	});
</script>

<svelte:head>
	<title>{$_('files.title')}</title>
</svelte:head>
{#if false}
	<div role="alert" class="alert alert-error mx-auto max-w-7xl">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6 shrink-0 stroke-current"
			fill="none"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		<span>{$_('files.hardwareFailureWarning')}</span>
	</div>
{/if}
{#snippet statusBadge(file)}
	{#if file.oldSystem}
		<span class="badge badge-info badge-sm">{$_('files.statusOld')}</span>
	{:else if file.state == 'READY'}
		<span class="badge badge-success badge-sm">{$_('files.statusReady')}</span>
	{:else if file.state == 'PROCESSING_ERROR'}
		<span class="badge badge-error badge-sm">{$_('files.statusError')}</span>
	{:else if file.state == 'PROCESSING'}
		<span class="badge badge-accent badge-sm">{$_('files.statusProcessing')}</span>
		{#if file.progress >= 0}
			<span class="text-xs tabular-nums text-base-content/60">{file.progress}%</span>
		{/if}
		<span class="loading loading-spinner loading-xs" aria-label={$_('files.loading')}></span>
	{:else if file.state == 'UPLOADED'}
		<span class="badge badge-info badge-sm">{$_('files.statusUploaded')}</span>
		<span class="loading loading-spinner loading-xs" aria-label={$_('files.loading')}></span>
	{/if}
{/snippet}

{#snippet downloadToggle(file)}
	<button
		class="btn btn-outline btn-xs gap-1"
		aria-expanded={openFormatsFor === file.id}
		onclick={(e) => toggleFormats(file.id, e)}
	>
		{$_('files.downloadButton')}
		<svg
			viewBox="0 0 12 12"
			class="h-2.5 w-2.5 transition-transform duration-150 motion-reduce:transition-none {openFormatsFor ===
			file.id
				? 'rotate-180'
				: ''}"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="M2 4.5 6 8.5 10 4.5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
{/snippet}

{#snippet deleteAction(file, extraClass)}
	<button
		class="btn btn-ghost btn-xs text-error/80 hover:bg-error/10 hover:text-error {extraClass}"
		onclick={(e) => {
			delFileId = file.id;
			e.stopPropagation();
			(document.getElementById('del-file-modal') as HTMLInputElement).checked = true;
		}}
	>
		{$_('files.deleteButton')}
	</button>
{/snippet}

<div class="min-h-[100dvh] w-full bg-base-100">
	<div class="mx-auto w-full max-w-6xl px-3 pb-20 pt-4 sm:px-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			{#if data.storage}
				<StorageBar
					used={data.storage.used}
					limit={data.storage.limit}
					remaining={data.storage.remaining}
					usedPercent={data.storage.usedPercent}
				/>
			{:else}
				<div></div>
			{/if}
			<div class="flex shrink-0 gap-2">
				<button
					class="btn btn-primary btn-sm gap-2 max-sm:w-full"
					onclick={() => uploadModal?.showModal()}
				>
					{$_('files.uploadButton')}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="h-4 w-4"
						aria-hidden="true"
						><path
							d="M11.007,2.578,11,18.016a1,1,0,0,0,1,1h0a1,1,0,0,0,1-1l.007-15.421,2.912,2.913a1,1,0,0,0,1.414,0h0a1,1,0,0,0,0-1.414L14.122.879a3,3,0,0,0-4.244,0L6.667,4.091a1,1,0,0,0,0,1.414h0a1,1,0,0,0,1.414,0Z"
						/><path
							d="M22,17v4a1,1,0,0,1-1,1H3a1,1,0,0,1-1-1V17a1,1,0,0,0-1-1H1a1,1,0,0,0-1,1v4a3,3,0,0,0,3,3H21a3,3,0,0,0,3-3V17a1,1,0,0,0-1-1h0A1,1,0,0,0,22,17Z"
						/></svg
					>
				</button>
			</div>
		</div>

		<!-- One list at every width: it stacks on a phone and lines up into columns
		     from md up, so a long filename never has to compete for horizontal room. -->
		{#if data.files && data.files.length > 0}
			<div class="mt-4 flex items-center justify-between gap-2">
				<label class="flex cursor-pointer items-center gap-2 text-sm text-base-content/70">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						checked={selectAll}
						onchange={toggleSelectAll}
					/>
					{$_('files.selectAll')}
				</label>
				{#if selectedFiles.size > 0}
					<button
						class="btn btn-error btn-xs"
						onclick={() =>
							((document.getElementById('bulk-del-modal') as HTMLInputElement).checked = true)}
					>
						{$_('files.deleteSelected')} ({selectedFiles.size})
					</button>
				{/if}
			</div>

			<ul class="mt-2 flex flex-col gap-2">
				{#each data.files as file (file.id)}
					<li class="relative overflow-hidden rounded-lg border border-base-300 bg-base-100">
						<!-- Status rail: a hairline when a file is done, coloured only when it isn't. -->
						<span class="absolute inset-y-0 left-0 w-1 bg-base-200" aria-hidden="true"></span>
						<span
							class="absolute left-0 top-0 w-1 {railClass(file)}"
							style="height: {railFill(file)}%"
							aria-hidden="true"
						></span>

						<div class="flex items-start gap-3 py-3 pl-4 pr-3 md:items-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm mt-0.5 shrink-0 md:mt-0"
								checked={selectedFiles.has(file.id)}
								onchange={(e) => toggleFileSelection(file.id, e)}
								aria-label="{$_('files.selectFile')}: {file.filename}"
							/>
							<div class="min-w-0 flex-1 md:flex md:items-center md:gap-4">
								<div class="min-w-0 md:flex-1">
									{#if file.state === 'READY' && !file.oldSystem}
										<button
											class="block w-full break-words text-left text-[15px] font-medium leading-snug hover:text-primary"
											onclick={() => openFile(file.id, file.state, file.oldSystem)}
										>
											{file.filename}
										</button>
									{:else}
										<p class="break-words text-[15px] font-medium leading-snug text-base-content/80">
											{file.filename}
										</p>
									{/if}
								</div>

								<!-- Fixed width from md up so status and date line up down the list. -->
								<div
									class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 md:mt-0 md:w-72 md:shrink-0 md:flex-nowrap md:justify-between"
								>
									<div class="flex items-center gap-1.5">
										{@render statusBadge(file)}
									</div>
									<span
										class="whitespace-nowrap tabular-nums text-base-content/60"
										title={toTime(file.uploadedAt)}
									>
										<span class="text-xs">{toDateParts(file.uploadedAt).date}</span>
										<span class="text-[11px] text-base-content/45">
											{toDateParts(file.uploadedAt).time}
										</span>
									</span>
								</div>

								<div
									class="mt-2.5 flex flex-wrap items-center gap-1.5 md:mt-0 md:w-52 md:shrink-0 md:flex-nowrap md:justify-end"
								>
									{#if file.oldSystem}
										<a class="btn btn-outline btn-xs" href="https://tekstiks.ee/files">
											{$_('files.toOldSystem')}
										</a>
									{:else if file.state === 'READY'}
										<button
											class="btn btn-primary btn-xs"
											onclick={() => openFile(file.id, file.state, file.oldSystem)}
										>
											{$_('files.openButton')}
										</button>
										{@render downloadToggle(file)}
									{/if}
									{@render deleteAction(file, 'max-md:ml-auto')}
								</div>
							</div>
						</div>

						{#if openFormatsFor === file.id && file.state === 'READY' && !file.oldSystem}
							<!-- pl-12 lines the drawer up with the filename, not the checkbox. -->
							<div class="border-t border-base-200 bg-base-200/40 pl-12 pr-3 md:flex md:justify-end">
								<FormatStrip fileId={file.id} filename={file.filename} />
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if !data.files || data.files.length === 0}
			<div class="mt-6 rounded-lg border border-dashed border-base-300 px-6 py-12 text-center">
				<p class="text-base-content/60">{error ? error : $_('files.noFiles')}</p>
				<button class="btn btn-primary btn-sm mt-4" onclick={() => uploadModal?.showModal()}>
					{$_('files.uploadButton')}
				</button>
			</div>
		{/if}
	</div>

	<dialog
		id="upload_modal"
		class="modal cursor-pointer modal-bottom sm:modal-middle"
		bind:this={uploadModal}
	>
		<!-- dvh: 100vh on mobile ignores the browser chrome, hiding the submit button -->
		<div class="modal-box relative max-h-[calc(100dvh-2rem)]">
			<h3 class="text-lg font-bold mb-4">{$_('files.uploadHeader')}</h3>
			<form method="dialog">
				<button
					class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
					aria-label={$_('files.close')}>✕</button
				>
			</form>
			{#if data.storage?.usedPercent >= 100}
				<div class="alert alert-warning mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<span>{$_('files.storageLimitWarning')}</span>
				</div>
			{/if}
			<form method="POST" enctype="multipart/form-data" onsubmit={uploadFile}>
				<fieldset
					disabled={loading}
					aria-busy={loading}
					class="fieldset w-full bg-base-200 border border-base-300 p-4 rounded-box"
				>
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
							class="select w-full max-w-xs mb-4"
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
							class="file-input file-input-primary w-full max-w-xs"
							type="file"
							bind:files={upload}
							accept="audio/*,video/*,.wav,.wave,.mp3,.mp2,.m4a,.aac,.flac,.ogg,.oga,.opus,.amr,.aiff,.aif,.aifc,.wma,.mka,.webm,.mp4,.m4v,.mov,.avi,.mkv,.mpeg,.mpg,.3gp,.3gpp,.3g2"
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
				<fieldset
					class="fieldset w-full max-w-md bg-base-200 border border-base-300 p-4 rounded-box mb-4"
				>
					<legend class="fieldset-legend">{$_('files.requirements')}</legend>
					<ul class="list-disc list-inside">
						<li class="py-1">{$_('files.supportedFormats')}</li>
						<li class="py-1">{$_('files.fileSizeLimit')}</li>
						<li class="py-1">{$_('files.fileDurationLimit')}</li>
					</ul>
				</fieldset>
				{#if error}
					<p class="mt-3 mb-3 text-red-500 text-center font-semibold">{printError(error)}</p>
				{/if}
				{#if form?.uploadLimit}
					<p class="mt-3 mb-3 text-red-500 text-center font-semibold">
						{printError('fileTooLong')}
					</p>
				{/if}
				<!-- sticky so the submit button stays visible when the modal content scrolls on mobile -->
				<div class="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-base-100 border-t border-base-300">
					{#if loading}
						<button class="btn" disabled aria-label={$_('files.uploadButton')}
							><span class="btn btn-ghost btn-xs loading" aria-label={$_('files.loading')}
							></span></button
						>
					{:else if upload}
						<button
							type="submit"
							class="btn btn-active btn-primary"
							aria-label={$_('files.uploadButton')}>{$_('files.uploadButton')}</button
						>
					{:else}
						<button class="btn" disabled>{$_('files.uploadButton')}</button>
					{/if}
				</div>
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
				<button
					type="button"
					class="btn btn-outline"
					onclick={() =>
						((document.getElementById('del-file-modal') as HTMLInputElement).checked = false)}
					>{$_('files.cancel')}</button
				>
				<button
					type="button"
					class="btn"
					onclick={() => delFile(delFileId)}
					onkeydown={(e) => e.key === 'Enter' && delFile(delFileId)}>{$_('files.delete')}</button
				>
			</div>
		</label>
	</label>

	<input type="checkbox" id="bulk-del-modal" class="modal-toggle" />
	<label for="bulk-del-modal" class="modal cursor-pointer">
		<label class="modal-box relative" for="">
			<h3 class="font-bold text-lg">{$_('files.deleteMultiple')}</h3>
			<p class="py-4">
				{$_('files.deleteMultipleWarning', { values: { count: selectedFiles.size } })}
			</p>
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-outline"
					onclick={() =>
						((document.getElementById('bulk-del-modal') as HTMLInputElement).checked = false)}
					disabled={bulkDeleting}
				>
					{$_('files.cancel')}
				</button>
				<button
					type="button"
					class="btn btn-error"
					onclick={deleteSelectedFiles}
					disabled={bulkDeleting}
				>
					{#if bulkDeleting}
						<span class="loading loading-spinner loading-sm"></span>
						{$_('files.deleting')}
					{:else}
						{$_('files.deleteAll')}
					{/if}
				</button>
			</div>
		</label>
	</label>
</div>

<style>
</style>
