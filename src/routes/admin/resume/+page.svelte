<script lang="ts">
    import type { PageData } from './$types';
    import { _ } from 'svelte-i18n';
    let { data }: { data: PageData } = $props();
    let error = $state('');
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
</script>

<svelte:head>
	<title>{$_('files.title')}</title>
</svelte:head>
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
					<tr	>
						<th>{index + 1}</th>
						<td class="">
							<p class="break-words whitespace-normal">
								{file.filename}
							</p>
						</td>
						<td>
							{#if file.state == 'READY'}
								<div class="badge badge-md badge-success pl-2 pr-2">{$_('files.statusReady')}</div>
							{:else if file.state == 'PROCESSING_ERROR'}
								<div class="badge badge-md badge-error pl-2 pr-2">{$_('files.statusError')}</div>
							{:else if file.state == 'PROCESSING'}
								<div class="badge badge-md badge-accent pl-2 pr-2">
									{$_('files.statusProcessing')} 
								</div>
								<span class="btn btn-ghost btn-xs" aria-label={$_('files.loading')}></span>
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
							{#if file.state == 'PROCESSING'}
								<form method="POST" action="?/resumeProcessing">
									<input type="hidden" name="fileId" value={file.id} />
									<button type="submit" class="btn btn-sm btn-primary">
										{$_('files.resumeButton')}
									</button>
								</form>
							{/if}
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
</div>

<style>
</style>