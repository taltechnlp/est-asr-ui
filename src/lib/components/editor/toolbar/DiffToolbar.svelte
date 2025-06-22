<script lang="ts">
	import { _ } from 'svelte-i18n';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import eye from 'svelte-awesome/icons/eye';
	import eyeSlash from 'svelte-awesome/icons/eyeSlash';
	import check from 'svelte-awesome/icons/check';
	import times from 'svelte-awesome/icons/times';
	import refresh from 'svelte-awesome/icons/refresh';

	interface Props {
		editor: any;
		showDiff: boolean;
		onToggleDiff: () => void;
		onApplyAll: () => void;
		onRejectAll: () => void;
		onRefreshDiff: () => void;
	}

	let {
		editor,
		showDiff,
		onToggleDiff,
		onApplyAll,
		onRejectAll,
		onRefreshDiff
	}: Props = $props();
</script>

<div class="flex items-center gap-2">
	<div class="flex items-center tooltip tooltip-bottom" data-tip={showDiff ? $_('diff.hide') : $_('diff.show')}>
		<button
			onclick={onToggleDiff}
			class="btn btn-ghost btn-sm"
			class:btn-active={showDiff}
		>
			<Icon data={showDiff ? eyeSlash : eye} scale={1.2} />
		</button>
	</div>
	
	{#if showDiff}
		<div class="divider divider-horizontal mx-1"></div>
		
		<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('diff.applyAll')}>
			<button
				onclick={onApplyAll}
				class="btn btn-ghost btn-sm text-success"
			>
				<Icon data={check} scale={1.2} />
			</button>
		</div>
		
		<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('diff.rejectAll')}>
			<button
				onclick={onRejectAll}
				class="btn btn-ghost btn-sm text-error"
			>
				<Icon data={times} scale={1.2} />
			</button>
		</div>
		
		<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('diff.refresh')}>
			<button
				onclick={onRefreshDiff}
				class="btn btn-ghost btn-sm"
			>
				<Icon data={refresh} scale={1.2} />
			</button>
		</div>
	{/if}
</div> 