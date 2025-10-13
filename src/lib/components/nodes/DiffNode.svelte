<script lang="ts">
	import { NodeViewWrapper } from 'svelte-tiptap';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import check from 'svelte-awesome/icons/check';
	import times from 'svelte-awesome/icons/times';
	import { _ } from 'svelte-i18n';
	
	export let node: any;
	export let editor: any;
	export let getPos: (() => number | undefined) | undefined = undefined;

	$: attrs = node.attrs;
	$: diffId = attrs.id;
	$: originalText = attrs.originalText || '';
	$: suggestedText = attrs.suggestedText || '';
	$: changeType = attrs.changeType || 'substitution'; // 'deletion' | 'substitution' | 'insertion'

	// Hide the diff if both texts are empty
	$: isEmpty = !originalText && !suggestedText;

	let showActions = false;

	function approveDiff(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (editor && diffId) {
			editor.chain().focus().approveDiff(diffId).run();
		}
	}

	function rejectDiff(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (editor && diffId) {
			editor.chain().focus().rejectDiff(diffId).run();
		}
	}
</script>

<NodeViewWrapper class="inline-diff-wrapper">
	{#if !isEmpty}
		<span
			class="inline-diff-container"
			contentEditable={false}
			onmouseenter={() => showActions = true}
			onmouseleave={() => showActions = false}
			role="group"
			tabindex="-1"
		>
			<!-- Position actions above while keeping inline flow -->
			{#if showActions}
				<span class="actions-container">
					<button
						class="action-btn approve"
						onclick={approveDiff}
						title={$_('common.apply')}
						type="button"
					>
						<Icon data={check} scale={0.8} />
					</button>
					<button
						class="action-btn reject"
						onclick={rejectDiff}
						title={$_('common.reject')}
						type="button"
					>
						<Icon data={times} scale={0.8} />
					</button>
				</span>
			{/if}

			<!-- Inline diff content - conditional rendering based on changeType -->
			{#if changeType === 'deletion'}
				<!-- Deletion: only show original text (strikethrough) -->
				<span class="original-text">{originalText}</span>
			{:else if changeType === 'insertion'}
				<!-- Insertion: only show suggested text (new) -->
				<span class="suggested-text insertion">{suggestedText}</span>
			{:else}
				<!-- Substitution: show both old and new -->
				<span class="original-text">{originalText}</span>
				<span class="suggested-text">{suggestedText}</span>
			{/if}
		</span>
	{/if}
</NodeViewWrapper>

<style>
	/* Target the TipTap wrapper */
	:global(.node-diff) {
		display: inline !important;
	}
	
	:global(.inline-diff-wrapper) {
		display: inline !important;
		position: relative;
	}

	.inline-diff-container {
		display: inline;
		position: relative;
		background: rgba(255, 248, 220, 0.6);
		border-radius: 3px;
		padding: 2px 3px;
		margin: 0 2px;
		border: 1px solid rgba(251, 191, 36, 0.4);
		transition: all 0.2s ease;
		/* Ensure inline flow */
		vertical-align: baseline;
		line-height: inherit;
	}

	.inline-diff-container:hover {
		background: rgba(255, 248, 220, 0.9);
		border-color: rgba(251, 191, 36, 0.6);
	}

	.original-text {
		color: #dc2626;
		text-decoration: line-through;
		text-decoration-color: #dc2626;
		background: rgba(254, 226, 226, 0.7);
		padding: 1px 3px;
		border-radius: 2px;
		/* Ensure inline */
		display: inline;
		vertical-align: baseline;
	}

	.suggested-text {
		color: #059669;
		background: rgba(220, 252, 231, 0.7);
		padding: 1px 3px;
		border-radius: 2px;
		margin-left: 3px;
		/* Ensure inline */
		display: inline;
		vertical-align: baseline;
	}

	/* Insertion-only styling - no margin-left since there's no original text */
	.suggested-text.insertion {
		margin-left: 0;
		font-weight: 500;
	}

	.actions-container {
		position: absolute;
		top: -36px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 6px;
		z-index: 10;
		pointer-events: auto;
		background: white;
		padding: 4px 6px 12px 6px;
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		white-space: nowrap;
	}
	
	/* Create a larger invisible bridge between text and buttons */
	.actions-container::before {
		content: '';
		position: absolute;
		bottom: -12px;
		left: -20px;
		right: -20px;
		height: 20px;
		background: transparent;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.15s ease;
		border: 1.5px solid;
		font-size: 12px;
		background: transparent;
	}

	.action-btn.approve {
		background: #f0fdf4;
		border-color: #10b981;
		color: #059669;
	}

	.action-btn.approve:hover {
		background: #dcfce7;
		transform: scale(1.1);
	}

	.action-btn.reject {
		background: #fef2f2;
		border-color: #ef4444;
		color: #dc2626;
	}

	.action-btn.reject:hover {
		background: #fee2e2;
		transform: scale(1.1);
	}

	/* Ensure proper spacing */
	.original-text + .suggested-text {
		margin-left: 4px;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.action-btn {
			width: 26px;
			height: 26px;
		}
		
		.actions-container {
			top: -38px;
			gap: 8px;
			padding: 5px 7px 14px 7px;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.original-text {
			background: #fee2e2;
			border: 1px solid #dc2626;
		}
		
		.suggested-text {
			background: #dcfce7;
			border: 1px solid #059669;
		}
		
		.inline-diff-container {
			border: 2px solid #f59e0b;
		}
		
		.actions-container {
			background: white;
			border: 1px solid #333;
		}
	}
</style>