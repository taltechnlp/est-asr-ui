<script lang="ts">
	import { NodeViewWrapper } from 'svelte-tiptap';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import check from 'svelte-awesome/icons/check';
	import times from 'svelte-awesome/icons/times';
	
	export let node: any;
	export let editor: any;
	export let getPos: () => number | undefined;

	$: attrs = node.attrs;
	$: diffId = attrs.id;
	$: originalText = attrs.originalText;
	$: suggestedText = attrs.suggestedText;
	$: changeType = attrs.changeType;
	$: confidence = attrs.confidence;

	function approveDiff() {
		if (editor && diffId) {
			editor.chain().focus().approveDiff(diffId).run();
		}
	}

	function rejectDiff() {
		if (editor && diffId) {
			editor.chain().focus().rejectDiff(diffId).run();
		}
	}
</script>

<NodeViewWrapper class="inline-diff-wrapper">
	<span class="inline-diff-container" contentEditable={false}>
		<!-- Action icons positioned above the diff -->
		<div class="diff-actions">
			<button 
				class="approve-icon" 
				onclick={approveDiff}
				title="Approve change"
			>
				<Icon data={check} scale={0.7} />
			</button>
			<button 
				class="reject-icon" 
				onclick={rejectDiff}
				title="Reject change"
			>
				<Icon data={times} scale={0.7} />
			</button>
		</div>
		
		<!-- Inline diff content -->
		<span class="diff-content">
			<span class="original-text">{originalText}</span>
			<span class="suggested-text">{suggestedText}</span>
		</span>
	</span>
</NodeViewWrapper>

<style>
	:global(.inline-diff-wrapper) {
		display: inline;
		position: relative;
	}

	.inline-diff-container {
		display: inline;
		position: relative;
		background: rgba(255, 248, 220, 0.6);
		border-radius: 3px;
		padding: 1px 3px;
		margin: 0 1px;
		border: 1px solid rgba(251, 191, 36, 0.4);
	}

	.inline-diff-container:hover {
		background: rgba(255, 248, 220, 0.9);
		border-color: rgba(251, 191, 36, 0.6);
	}

	.diff-actions {
		position: absolute;
		top: -28px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 2px;
		z-index: 10;
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
		/* Add padding to create a hover bridge */
		padding: 2px 4px 8px 4px;
	}

	/* Create an invisible bridge between text and icons */
	.diff-actions::before {
		content: '';
		position: absolute;
		bottom: -8px;
		left: -10px;
		right: -10px;
		height: 8px;
		background: transparent;
	}

	.inline-diff-container:hover .diff-actions,
	.diff-actions:hover {
		opacity: 1;
		pointer-events: all;
	}

	.approve-icon,
	.reject-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.15s ease;
		border: 1px solid;
		font-size: 11px;
	}

	.approve-icon {
		background: #f0fdf4;
		border-color: #10b981;
		color: #059669;
	}

	.approve-icon:hover {
		background: #dcfce7;
		transform: scale(1.1);
	}

	.reject-icon {
		background: #fef2f2;
		border-color: #ef4444;
		color: #dc2626;
	}

	.reject-icon:hover {
		background: #fee2e2;
		transform: scale(1.1);
	}

	.diff-content {
		display: inline;
		line-height: inherit;
	}

	.original-text {
		color: #dc2626;
		text-decoration: line-through;
		text-decoration-color: #dc2626;
		background: rgba(254, 226, 226, 0.7);
		padding: 1px 2px;
		border-radius: 2px;
	}

	.suggested-text {
		color: #059669;
		background: rgba(220, 252, 231, 0.7);
		padding: 1px 2px;
		border-radius: 2px;
		margin-left: 2px;
	}

	/* Ensure proper spacing when both texts are present */
	.original-text + .suggested-text {
		margin-left: 4px;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.diff-actions {
			top: -28px;
		}
		
		.approve-icon,
		.reject-icon {
			width: 22px;
			height: 22px;
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