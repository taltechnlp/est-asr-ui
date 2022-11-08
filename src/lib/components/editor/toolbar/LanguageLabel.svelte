<script lang="ts">
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import ellipsisH from 'svelte-awesome/icons/ellipsis-h';
	import close from 'svelte-awesome/icons/close';
	import { lang, languageAnnotationOptions } from '$lib/stores';
	import { _ } from 'svelte-i18n';
	export let editor;
	const colors = [
		{ class: 'warning', code: '#FBBD23' },
		{ class: 'neutral', code: '#70ACC7' },
		{ class: 'info', code: '#3ABFF8' },
		{ class: 'success', code: '#36D399' },
		{ class: 'error', code: '#F87272' },
		{ class: 'primary', code: '#177E89' }
	];
	const getColor = (index: number) => colors[index % colors.length];
</script>

<div class="flex items-center flex-col sm:flex-row">
	<p class="mr-2 tooltip tooltip-bottom text-sm" data-tip={$_('file.toolbar.languageTooltip')}>
		{$_('file.toolbar.language')}
	</p>
	<div class="btn-group">
		{#if $editor}
			{#if $editor.isActive('labelHighlight')}
				<button on:click={() => $editor.chain().focus().toggleHighlight().run()}>
					<Icon data={close} scale={1} class="mb-1 mr-1" />
				</button>
			{/if}
			{#each $languageAnnotationOptions as lang, index}
				{#if lang.active}
					<button
						on:click={() =>
							$editor
								.chain()
								.focus()
								.setHighlight({
									color: getColor(index).code,
									annolabel: 'language',
									annovalue: lang.label
								})
								.run()}
						class="btn btn-xs btn-outline btn-{getColor(index).class} {$editor.isActive(
							'labelHighlight'
						)
							? 'btn-active'
							: ''}"
					>
						{lang.label}
					</button>
				{/if}
			{/each}
			<label for="languages-modal" class="btn btn-xs btn-outline">
				<Icon data={ellipsisH} scale={1} class="mt-2" />
			</label>
		{/if}
	</div>
</div>
