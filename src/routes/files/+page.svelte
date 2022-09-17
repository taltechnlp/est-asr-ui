<script lang="ts">
	import { files as filesStore } from '$lib/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { toTime } from './helpers'
	import { browser } from '$app/environment';
	export let error = '';
	export let data;
	filesStore.set(data.files);
	let loading = false;
	let upload;

	const uploadFile = async (event: Event) => {
		event.preventDefault();
		const formData = new FormData();
		formData.append('file', upload[0]);
		loading = true;
		const result = await fetch('/api/files/upload', {
			method: 'POST',
			body: formData
		});
		if (!result.ok) {
			loading = false;
			const body = await result.json();
			return body.error;
		}
		loading = false;
		uploadModalOpen = false;
		const response = await fetch('/api/files');
		if (!response.ok) {
			goto('/files');
		}
		const body = await response.json()
		filesStore.set(body.files)
		longPolling()
	};
	let delFileId;
	const delFile = async (fileId) => {
		const response = await fetch('/api/files/' + fileId, {
			method: 'DELETE'
		});
		if (!response.ok) {
			console.log('Server error');
		} else {
			filesStore.set($filesStore.filter(x => x.id != fileId))	
		}
		return;
	};

	const updateFileStore = async () => {
		console.log("invalidating")
		const response = await fetch('/api/files');
		if (!response.ok) {
			console.log("Failed to update files. Check internet connection.")
		}
		const body = await response.json()
		filesStore.set(body.files)
	};

	function openFile(fileId, fileState) {
		if (fileState == 'READY') {
			goto(`/files/${fileId}`);
		}
	}
	let timeoutID;
	const longPolling = async () => {
		if ($filesStore.find((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')) {
			timeoutID = await setTimeout(async () => {
				const files = await updateFileStore();
				if (!$filesStore.find((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')) {
					clearTimeout(timeoutID);
					timeoutID = null;
				} else {
					longPolling();
				}
			}, 20000);
		} else if (timeoutID) {
			clearTimeout(timeoutID);
			timeoutID = null;
		}
	};
	if (browser) longPolling();

	let uploadModalOpen = false;
	const uploadModalClick = (e: Event) => {
		e.preventDefault();
		uploadModalOpen = !uploadModalOpen
	}
</script>

<svelte:head>
	<title>{$_('files.title')}</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_1280px)] overflow-x-auto">
	<div class="flex justify-end max-w-screen-2xl">
		<label for="file-upload" class="btn btn-primary gap-2 mt-5 mb-2 modal-button right">
			{$_('files.uploadButton')}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				id="Outline"
				viewBox="0 0 24 24"
				fill="#fff"
				class="h-4 w-4"
				><path
					d="M11.007,2.578,11,18.016a1,1,0,0,0,1,1h0a1,1,0,0,0,1-1l.007-15.421,2.912,2.913a1,1,0,0,0,1.414,0h0a1,1,0,0,0,0-1.414L14.122.879a3,3,0,0,0-4.244,0L6.667,4.091a1,1,0,0,0,0,1.414h0a1,1,0,0,0,1.414,0Z"
				/><path
					d="M22,17v4a1,1,0,0,1-1,1H3a1,1,0,0,1-1-1V17a1,1,0,0,0-1-1H1a1,1,0,0,0-1,1v4a3,3,0,0,0,3,3H21a3,3,0,0,0,3-3V17a1,1,0,0,0-1-1h0A1,1,0,0,0,22,17Z"
				/></svg
			>
		</label>
	</div>
	<table class="table max-w-screen-2xl">
		<thead>
			<tr>
				<th />
				<th>{$_('files.filename')}</th>
				<th>{$_('files.status')}</th>
				<th>{$_('files.uploadedAt')}</th>
				<th>{$_('files.actions')}</th>
			</tr>
		</thead>
		<tbody>
			{#if $filesStore}
				{#each $filesStore as file, index}
					<tr
						class="{file.state == 'READY' ? 'cursor-pointer' : ''} hover"
						on:click={() => openFile(file.id, file.state)}
					>
						<th>{index + 1}</th>
						<td class="">
							{file.filename}
						</td>
						<td href="/files/{file.id}">
							{#if file.state == 'READY'}
								<div class="badge badge-success">{$_('files.statusReady')}</div>
							{:else if file.state == 'PROCESSING_ERROR'}
								<div class="badge badge-error">{$_('files.statusError')}</div>
							{:else if file.state == 'PROCESSING'}
								<div class="badge badge-accent loading">{$_('files.statusProcessing')}</div>
								<span class="btn btn-ghost btn-xs loading" />
							{:else if file.state == 'UPLOADED'}
								<div class="badge badge-info loading">{$_('files.statusUploaded')}</div>
								<span class="btn btn-ghost btn-xs loading" />
							{/if}
						</td>
						<td class="">
							{toTime(file.uploadedAt)}
						</td>
						<td class="">
							{#if file.state == 'READY'}
								<button class="btn btn-outline btn-xs">{$_('files.openButton')}</button>
							{/if}

							<label
								for="del-file-modal"
								class="btn btn-outline btn-xs"
								on:click={(e) => {
									delFileId = file.id;
									e.stopPropagation();
								}}>{$_('files.deleteButton')}</label
							>
						</td>
					</tr>
				{/each}
			{:else if error}
				<p class="">{error}</p>
			{/if}
		</tbody>
	</table>

	<input type="checkbox" id="file-upload" class="modal" on:click={uploadModalClick} />
	<label for="file-upload" class="modal cursor-pointer {uploadModalOpen ? "modal-open" : ""}">
		<label class="modal-box relative" for="">
			<fieldset disabled={loading} aria-busy={loading}>
				<label for="file-upload" class="btn btn-sm btn-circle absolute right-2 top-2" lang="et"
					>✕</label
				>
				<h3 class="text-lg font-bold mb-4">{$_('files.uploadHeader')}</h3>
				<input
					class="input input-bordered pt-1"
					type="file"
					bind:files={upload}
					accept="audio/*,video/*,audio/wav,audio/x-wav,audio/mp3,audio/mpeg,audio/ogg,video/ogg,video/x-mpeg2,video/mpeg2,audio/x-m4a,audio/flac,audio/x-flac,audio/x-amr,audio/amr"
					id="file"
					name="file"
					placeholder="Lae helisalvestis ülesse (kuni 100 MB)"
					required
				/>
				<ul class="list-disc list-inside">
					<li class="py-4">{$_('files.supportedFormats')}</li>
					<li class="py-4 pt-0">{$_('files.fileSizeLimit')}</li>
				</ul>
				{#if error}
					<p class="mt-3 text-red-500 text-center font-semibold">{$_('files.uploadError')}</p>
				{/if}
				{#if loading}
					<button class="btn" type="submit" disabled
						><span class="btn btn-ghost btn-xs loading" /></button
					>
				{:else if upload}
					<button on:click={uploadFile} class="btn btn-active btn-primary" type="submit"
						>{$_('files.uploadButton')}</button
					>
				{:else}
					<button class="btn" type="submit" disabled>{$_('files.uploadButton')}</button>
				{/if}
			</fieldset>
		</label>
	</label>

	<input type="checkbox" id="del-file-modal" class="modal-toggle" />
	<label for="del-file-modal" class="modal cursor-pointer">
		<label class="modal-box relative" for="">
			<h3 class="font-bold text-lg">{$_('files.fileDeletion')}</h3>
			<p class="py-4">
				{$_('files.fileDeletionWarning')}
			</p>
			<div class="modal-action">
				<label for="del-file-modal" class="btn btn-outline">{$_('files.cancel')}</label>
				<label for="del-file-modal" class="btn" on:click={() => delFile(delFileId)}
					>{$_('files.delete')}</label
				>
			</div>
		</label>
	</label>
</div>

<style>
</style>
