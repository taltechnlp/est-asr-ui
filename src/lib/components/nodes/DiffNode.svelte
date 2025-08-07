<script lang="ts">
	import { NodeViewWrapper } from 'svelte-tiptap';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import check from 'svelte-awesome/icons/check';
	import times from 'svelte-awesome/icons/times';
	
	interface Props {
		node: any;
		editor: any;
		getPos?: () => number | undefined;
	}

	let { node, editor }: Props = $props();

	let attrs = $derived(node.attrs);
	let diffId = $derived(attrs.id);
	let originalText = $derived(attrs.originalText);
	let suggestedText = $derived(attrs.suggestedText);

	let showActions = $state(false);

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
	<span 
		class="inline-diff-container" 
		contentEditable={false}
		onmouseenter={() => showActions = true}
		onmouseleave={() => showActions = false}
		role="group"
		tabindex="-1"
	>
		<!-- Inline diff content with embedded actions -->
		<span class="original-text">{originalText}</span>
		<span class="suggested-text">{suggestedText}</span>
		{#if showActions}
			<span class="inline-actions">
				<button 
					class="action-btn approve" 
					onclick={approveDiff}
					title="Approve change"
					type="button"
				>
					<Icon data={check} scale={0.5} />
				</button>
				<button 
					class="action-btn reject" 
					onclick={rejectDiff}
					title="Reject change"
					type="button"
				>
					<Icon data={times} scale={0.5} />
				</button>
			</span>
		{/if}
	</span>
</NodeViewWrapper>

<style>
	/* Target the TipTap wrapper */
	:global(.node-diff) {
		display: inline !important;
	}
	
	:global(.inline-diff-wrapper) {
		display: inline !important;
		/* Remove all positioning to maintain inline flow */
	}

	.inline-diff-container {
		display: inline;
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

	.inline-actions {
		/* Keep actions inline */
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-left: 4px;
		vertical-align: middle;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.15s ease;
		border: 1px solid;
		font-size: 10px;
		/* Ensure inline positioning */
		vertical-align: middle;
		background: transparent;
	}

	.action-btn.approve {
		background: #f0fdf4;
		border-color: #10b981;
		color: #059669;
	}

	.action-btn.approve:hover {
		background: #dcfce7;
		transform: scale(1.15);
	}

	.action-btn.reject {
		background: #fef2f2;
		border-color: #ef4444;
		color: #dc2626;
	}

	.action-btn.reject:hover {
		background: #fee2e2;
		transform: scale(1.15);
	}

	/* Ensure proper spacing */
	.original-text + .suggested-text {
		margin-left: 4px;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.action-btn {
			width: 18px;
			height: 18px;
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
	}
</style>