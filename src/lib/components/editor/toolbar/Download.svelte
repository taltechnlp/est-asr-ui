<script lang="ts">
	import { _ } from 'svelte-i18n';
    import { editor } from '$lib/stores';
    import { downloadHandler } from '$lib/download';
    let { fileName } = $props();
	let downloadOptions = [
		{ id: 1, text: `Word (.docx)` },
		{ id: 2, text: `JSON` }
	];
	let format = $state();
    let includeNames = $state(true);
    let includeTimeCodes = $state(false);
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
                <label for="download-modal" class="btn btn-primary"
                onclick={() => {
                    if (format.id === 1) downloadHandler($editor.getJSON(), '', fileName, includeNames, includeTimeCodes);
                    else {
                        const blob = new Blob([JSON.stringify($editor.getJSON())], {type: "application/json"});
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'transkriptsioon.json';
                        document.body.appendChild(a); // need to append the element to the dom -> otherwise it will not work in firefox
                        a.click();
                        a.remove();
                    }
						}}>{$_('editor.download.download')}</label>
                <label for="download-modal" class="btn btn-outline">{$_('editor.download.cancel')}</label>
            </div>
        </fieldset>
	</div>
</div>
