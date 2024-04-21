<script lang="ts">
    import type { PageData } from './$types';
    import * as Table from "$lib/components/ui/table";
    import { _ } from 'svelte-i18n';

    export let data: PageData;
    let error = '';
</script>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_1280px)] overflow-x-auto">
    <Table.Root>
        <Table.Caption>A list of your recent invoices.</Table.Caption>
        <Table.Header>
            <Table.Row>
                <Table.Head class="w-[100px]">Invoice</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Method</Table.Head>
                <Table.Head class="text-right">Amount</Table.Head>
            </Table.Row>
        </Table.Header>
        <Table.Body>
            {#if data.files}
				{#each data.files as file, index}
                    <Table.Row>
						<Table.Cell class="font-medium">{index + 1}</Table.Cell>
						<Table.Cell>
							<p class="break-words whitespace-normal">
								{file.filename}
							</p>
						</Table.Cell>
						<Table.Cell>
							{#if file.state == 'READY'}
								<div class="badge badge-success">{$_('files.statusReady')}</div>
							{:else if file.state == 'PROCESSING_ERROR'}
								<div class="badge badge-error">{$_('files.statusError')}</div>
							{:else if file.state == 'PROCESSING'}
								<div class="badge badge-accent loading">{$_('files.statusProcessing')} 
								</div>
								<span class="btn btn-ghost btn-xs loading" />
							{:else if file.state == 'UPLOADED'}
								<div class="badge badge-info loading">{$_('files.statusUploaded')}</div>
								<span class="btn btn-ghost btn-xs loading" />
							{/if}
                        </Table.Cell>
						<Table.Cell>
							{file.uploadedAt}
                        </Table.Cell>
						<Table.Cell>
							{#if file.state == 'READY'}
								<button class="btn btn-outline btn-xs">{$_('files.openButton')}</button>
							{/if}
                        </Table.Cell>
					</Table.Row>
				{/each}
			{:else if error}
				<p class="">{error}</p>
			{/if}
        </Table.Body>
    </Table.Root>
</div>