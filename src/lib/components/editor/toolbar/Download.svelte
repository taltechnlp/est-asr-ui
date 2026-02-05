<script lang="ts">
	import { _ } from 'svelte-i18n';
    import { editor } from '$lib/stores.svelte';
    import { downloadHandler } from '$lib/download';
    import { toSRT } from '$lib/helpers/converters/srtFormat';
    import { toTRS } from '$lib/helpers/converters/trsFormat';
    let { fileName } = $props();
	let downloadOptions = [
		{ id: 1, text: `Word (.docx)` },
		{ id: 2, text: `JSON` },
		{ id: 3, text: `SRT (.srt)` },
		{ id: 4, text: `TRS (.trs)` }
	];
	let format: { id: number; text: string } = $state(undefined);
    let includeNames = $state(true);
    let includeTimeCodes = $state(false);
    let isGenerating = $state(false);
</script>

<input type="checkbox" id="download-modal" class="modal-toggle" />
<div class="modal">
	<div class="modal-box" style="max-width: 21rem">
		<h3 class="font-bold text-lg">{$_('editor.download.heading')}</h3>
		<p class="py-4">
			{$_('editor.download.description')}
		</p>
        <fieldset class="w-72 mt-5">
            <label class="cursor-pointer flex flex-col">
                <span class="label-text">
                    {$_('editor.download.format')}
                </span>
                <select bind:value={format} class="select select-primary w-full">
                    {#each downloadOptions as opt}
                    <option value={opt}>
                        {opt.text}
                    </option>
                    {/each}
                </select>
            </label>
            {#if format && format.id === 1}
            <div class="form-control mt-3">
                <label class="label cursor-pointer flex">
                    <span class="label-text">{$_('editor.download.includeNames')}</span>
                    <input type="checkbox" class="" bind:checked={includeNames} />
                </label>
            </div>
            <div class="form-control mt-3">
                <label class="label cursor-pointer flex">
                    <span class="label-text">{$_('editor.download.includeTimeCodes')}</span>
                    <input type="checkbox" class="" bind:checked={includeTimeCodes} />
                </label>
            </div>
            {/if}
            <div class="mt-5 flex justify-between">
                <button
                class="btn btn-primary"
                class:loading={isGenerating}
                disabled={isGenerating}
                onclick={async () => {
                    if (format.id === 1) {
                        downloadHandler($editor.getJSON(), '', fileName, includeNames, includeTimeCodes);
                        document.getElementById('download-modal')?.click();
                    } else if (format.id === 2) {
                        const blob = new Blob([JSON.stringify($editor.getJSON())], {type: "application/json"});
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'transkriptsioon.json';
                        document.body.appendChild(a); // need to append the element to the dom -> otherwise it will not work in firefox
                        a.click();
                        a.remove();
                        document.getElementById('download-modal')?.click();
                    } else if (format.id === 3) {
                        isGenerating = true;
                        try {
                            // Use setTimeout to allow UI to update with loading state
                            await new Promise(resolve => setTimeout(resolve, 10));
                            const srtContent = toSRT($editor.getJSON());
                            const blob = new Blob([srtContent], {type: "text/plain"});
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${fileName}.srt`;
                            document.body.appendChild(a); // need to append the element to the dom -> otherwise it will not work in firefox
                            a.click();
                            a.remove();
                            document.getElementById('download-modal')?.click();
                        } finally {
                            isGenerating = false;
                        }
                    } else if (format.id === 4) {
                        isGenerating = true;
                        try {
                            // Use setTimeout to allow UI to update with loading state
                            await new Promise(resolve => setTimeout(resolve, 10));
                            const trsContent = toTRS($editor.getJSON(), fileName);
                            const blob = new Blob([trsContent], {type: "application/xml"});
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${fileName}.trs`;
                            document.body.appendChild(a); // need to append the element to the dom -> otherwise it will not work in firefox
                            a.click();
                            a.remove();
                            document.getElementById('download-modal')?.click();
                        } finally {
                            isGenerating = false;
                        }
                    }
					}}>
                    {#if isGenerating}
                        <span class="loading loading-spinner"></span>
                        {$_('editor.download.generating')}
                    {:else}
                        {$_('editor.download.download')}
                    {/if}
                </button>
                <label for="download-modal" class="btn btn-outline">{$_('editor.download.cancel')}</label>
            </div>
        </fieldset>
	</div>
</div>
