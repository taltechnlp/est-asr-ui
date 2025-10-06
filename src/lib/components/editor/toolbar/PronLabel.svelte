<script lang="ts">
	import { run } from 'svelte/legacy';

	import Icon from 'svelte-awesome/components/Icon.svelte';
	import comment from 'svelte-awesome/icons/comment';
	import close from 'svelte-awesome/icons/close';
	import { _ } from 'svelte-i18n';
	import { v4 as uuidv4 } from 'uuid';
	let { editor } = $props();
	let label: string = $state('');
	let url = $state();
	let dropdown = $state();
	let test;
	run(() => {
		console.log(test)
	});

	const setLabel = () => {
		if (label.length > 0) {
			const id = uuidv4().slice(-12);
			const cssClass = `pron-${id}`;
			$editor
				.chain()
				.focus()
				.setPronHighlight({
					id,
					color: '#F87272',
					annolabel: 'pron',
					annovalue: `${url ? 'url:' : ''}${label}`,
					class: cssClass + " pron-label"
				})
				.setMeta('pron', {color: '#F87272', annovalue: label})
				.run();
			//const propStr = `content: "bla";`;
			const propStr = `content: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' height='16' width='54.133331298828125><text x="0" y="11" style="font-size: 9.5px; font-weight: bold; font-family:"Monaco">${label}</text></svg>`)}");`;
			// const propStr = `content: url("%3Csvg xmlns='http://www.w3.org/2000/svg' height='16' width='54.133331298828125'%3E%3Ctext x='0' y='11' style='font-size: 9.5px; font-weight: bold; font-family:'Monaco'%3ELanguage%3C/text%3E%3C/svg%3E");`;
			/* document.styleSheets[0].insertRule(
				`.${cssClass}::after{color:red !important;}`, 0); */
			document.styleSheets[0].insertRule(
				`.${cssClass}::after{${propStr}}`, 0);
		};
		label = '';
		url = false;
	};
	function init(el){
		el.focus()
	}
</script>

<div class="flex items-center flex-col sm:flex-row">
	<p class="mr-2 tooltip tooltip-bottom text-sm" data-tip={$_('file.toolbar.pronTooltip')}>
		{$_('file.toolbar.pron')}
	</p>
	{#if $editor}
		{#if $editor.isActive('pronHighlight')}
			<button onclick={() => $editor.chain().focus().togglePronHighlight().run()}>
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
				tabindex="-1"
				class="dropdown-content card card-sm w-80 p-2 shadow-lg bg-slate-50 text-primary-focus"
				bind:this={dropdown}
			>
				<div class="card-body">
					<label for="">
						<input
							type="text"
							name="pron"
							id="pron"
							bind:value={label}
							placeholder={$_('file.toolbar.pronPlaceholder')}
							use:init
						/>
					</label>
					<label for="">
						<input type="checkbox" name="url" id="url" bind:checked={url} />
						{$_('file.toolbar.internetAddress')}
					</label>
					<div class="flex justify-between">
						<button
							class="btn btn-primary"
							class:btn-disabled={label.length === 0}
							onclick={setLabel}>{$_('file.toolbar.add')}</button
						>
						<button class="btn btn-ghost" onclick={() => $editor.chain().focus().run()}
							>{$_('file.toolbar.cancel')}</button
						>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
<style>
	.card-body {
		width: 320px;
	}
</style>