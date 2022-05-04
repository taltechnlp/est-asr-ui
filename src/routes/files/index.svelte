<script context="module">
	import { user as userStore, files as filesStore } from '$lib/stores';
	import { browser } from '$app/env';
	import { GRAPHQL_ENDPOINT } from '$lib/graphql-client';
	import { getUser } from '$lib/queries/user';
	import { deleteFile } from '$lib/mutations/deleteFile';
	import { getFiles } from '$lib/queries/files';
	import { _ } from 'svelte-i18n';

	0; // TODO: sundida load fn uuesti laadima pärast failide mutatsiooni.
	// Selleks piisab kui parameetrid muutuvad. Teine variant on igas mutatsioonis uuesti laadida.

	// TODO: Long polling kui state on mõnel failil processing.
	export async function load({ params, fetch, session, stuff }) {
		let userId;
		userStore.subscribe((user) => {
			if (user && user.id) {
				userId = user.id;
			}
		});
		if (!userId) {
			const user = await getUser();
			if (user) userStore.set(user);
		}
		if (userId) {
			const files = await getFiles(userId);
			if (files) {
				filesStore.set(files);
				return {
					status: 200,
					props: {
						userId
					}
				};
			} else
				return {
					status: 200,
					props: {
						userId
					}
				};
		} else return {};
	}
</script>

<script>
	import { goto } from '$app/navigation';
	import { identity } from 'svelte/internal';
	export let userId = '';
	export let error = '';
	const toTime = (timestampt) => {
		const ts = new Date(timestampt);
		const date = ts.toLocaleDateString('et-ET', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
		const time = ts.toLocaleTimeString('et-ET', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		return `${date} ${time}`;
	};

	let loading = false;
	let upload;

	const uploadFile = async () => {
		const formData = new FormData();
		const query = `
			mutation Mutation($file: Upload!) {
				singleUpload(file: $file) {
					id
					filename
					duration
					uploadedAt
					textTitle
					state
				}
			}
		`;
		const variables = { file: null };
		const operations = JSON.stringify({
			query,
			variables
		});
		formData.append('operations', operations);
		const map = `{"0": ["variables.file"]}`;
		formData.append('map', map);
		formData.append('0', upload[0]);
		console.log('formData', formData);
		try {
			error = '';
			const response = await fetch(GRAPHQL_ENDPOINT, {
				method: 'POST',
				credentials: 'include',
				body: formData
			});
			const data = await response.json();
			const files = await getFiles(userId);
			filesStore.set(files);
			if (!timeoutID) longPolling();
			const checkBox = document.getElementById('file-upload');
			// @ts-ignore
			checkBox.checked = false;
			return;
		} catch (err) {
			error = err;
			return;
		}
	};

	let delFileId;
	const delFile = async (fileId) => {
		await deleteFile(fileId);
		const files = await getFiles(userId);
		filesStore.set(files);
	};

	function openFile(fileId, fileState) {
		if (fileState == 'READY') {
			goto(`/files/${fileId}`);
		}
	}
	let timeoutID;
	const longPolling = async () => {
		if ($filesStore.find((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')) {
			console.log('long-polling');
			timeoutID = await setTimeout(async () => {
				console.log('poll');
				const files = await getFiles(userId);
				if (files) {
					filesStore.set(files);
				}
				if (!$filesStore.find((x) => x.state == 'PROCESSING' || x.state == 'UPLOADED')) {
					clearTimeout(timeoutID);
					timeoutID = null;
				}
			}, 20000);
		} else if (timeoutID) {
			clearTimeout(timeoutID);
			timeoutID = null;
		}
	};
	longPolling();

	let uploadFormOpen;
</script>

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
								<button
									class="btn btn-outline btn-xs"
									on:click={(e) => {
										e.stopPropagation();
									}}>{$_('files.downloadButton')}</button
								>
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

	<input type="checkbox" id="file-upload" class="modal-toggle" />
	<label for="file-upload" class="modal cursor-pointer">
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
					<p class="mt-3 text-red-500 text-center font-semibold">{error}</p>
				{/if}
				{#if upload && upload[0]}
					<button on:click={uploadFile} class="btn btn-active btn-primary" type="submit"
						>{$_('files.uploadButton')}</button
					>
				{:else}
					<button class="btn btn-active btn-primary" type="submit" disabled
						>{$_('files.uploadButton')}</button
					>
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
