<script lang="ts">
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import comment from 'svelte-awesome/icons/comment';
	import close from 'svelte-awesome/icons/close';
	import { _ } from 'svelte-i18n';
	export let editor;
	let label: string = '';
	let url;
	let dropdown;

	const setLabel = () => {
		if (label.length > 0)
			$editor
				.chain()
				.focus()
				.setPronHighlight({
					color: '#F87272',
					annolabel: 'pron',
					annovalue: `${url ? 'url:' : ''}${label}`
				})
				.run();
		label = '';
		url = false;
	};
</script>

<div class="flex items-center flex-col sm:flex-row">
	<p class="mr-2 tooltip tooltip-bottom text-sm" data-tip={$_('file.toolbar.pronTooltip')}>
		{$_('file.toolbar.pron')}
	</p>
	{#if $editor}
		{#if $editor.isActive('pronHighlight')}
			<button on:click={() => $editor.chain().focus().togglePronHighlight().run()}>
				<Icon data={close} scale={1} class="mb-1 mr-1" />
			</button>
		{/if}
		<div class="dropdown dropdown-bottom dropdown-end">
			<button
				class="btn btn-xs btn-error flex flex-nowrap {$editor.isActive('pronHighlight')
					? 'btn-active'
					: 'btn-outline'}"
			>
				<Icon data={comment} scale={1} />
				<div class="ml-1 leading-3">{$_('file.toolbar.pron')}</div>
			</button>
			<div
				tabindex="0"
				class="dropdown-content card card-compact w-64 p-2 shadow-lg bg-slate-50 text-primary-focus"
				bind:this={dropdown}
			>
				<div class="card-body">
					<label>
						<input
							type="text"
							name="pron"
							id="pron"
							bind:value={label}
							placeholder={$_('file.toolbar.pronPlaceholder')}
						/>
					</label>
					<label>
						<input type="checkbox" name="url" id="url" bind:checked={url} />
						{$_('file.toolbar.internetAddress')}
					</label>
					<div class="flex justify-between">
						<button
							class="btn btn-primary"
							class:btn-disabled={label.length === 0}
							on:click={setLabel}>{$_('file.toolbar.add')}</button
						>
						<button class="btn btn-ghost" on:click={() => $editor.chain().focus().run()}
							>{$_('file.toolbar.cancel')}</button
						>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
