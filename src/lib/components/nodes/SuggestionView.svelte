<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap';

	interface Props {
		node: NodeViewProps['node'];
		decorations: NodeViewProps['decorations'];
		extension: NodeViewProps['extension'];
		updateAttributes: NodeViewProps['updateAttributes'];
		deleteNode: NodeViewProps['deleteNode'];
		editor: NodeViewProps['editor'];
		getPos: NodeViewProps['getPos'];
		selected?: NodeViewProps['selected'];
	}

	let {
		node = $bindable(),
		decorations,
		extension,
		updateAttributes,
		deleteNode,
		editor,
		getPos,
		selected = false
	}: Props = $props();

	let isDropdownOpen = $state(false);
	let suggestions = $state(node.attrs.suggestions || []);
	let originalText = $state(node.attrs.originalText || '');

	const handleSuggestionClick = (suggestion: string) => {
		// Apply the suggestion and replace the node with corrected text
		const pos = getPos();
		
		if (pos !== null) {
			try {
				// Since this is a block node with inline content, replace with a paragraph containing the text
				const textNode = editor.state.schema.text(suggestion);
				const paragraphNode = editor.state.schema.nodes.paragraph.create({}, textNode);
				
				// Create a transaction to replace the suggestion node with the paragraph
				const transaction = editor.state.tr.replaceWith(
					pos,
					pos + node.nodeSize,
					paragraphNode
				);
				
				// Apply the transaction
				editor.view.dispatch(transaction);
			} catch (error) {
				console.error('Error in handleSuggestionClick:', error);
			}
		}
		
		isDropdownOpen = false;
	};

	const handleIgnore = () => {
		// Replace suggestion with original text
		const pos = getPos();
		
		if (pos !== null) {
			try {
				// Create paragraph with original text
				const textNode = editor.state.schema.text(originalText);
				const paragraphNode = editor.state.schema.nodes.paragraph.create({}, textNode);
				
				const transaction = editor.state.tr.replaceWith(
					pos,
					pos + node.nodeSize,
					paragraphNode
				);
				
				editor.view.dispatch(transaction);
			} catch (error) {
				console.error('Error in handleIgnore:', error);
			}
		}
		
		isDropdownOpen = false;
	};

	const toggleDropdown = () => {
		isDropdownOpen = !isDropdownOpen;
	};
</script>

<NodeViewWrapper class="suggestion-wrapper" data-suggestion={true}>
	<span 
		class="suggestion-text {isDropdownOpen ? 'suggestion-active' : ''}" 
		contentEditable={false}
		onclick={toggleDropdown}
		role="button"
		tabindex="0"
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleDropdown();
			}
		}}
	>
		{originalText}
		
		{#if suggestions.length > 0}
			<span class="suggestion-indicator">⚠</span>
			
			{#if isDropdownOpen}
				<div 
					class="suggestion-dropdown"
					contentEditable={false}
				>
					<div class="suggestion-header">Suggestions:</div>
					
					{#each suggestions as suggestion}
						<button 
							class="suggestion-option"
							onclick={(e) => {
								e.stopPropagation();
								handleSuggestionClick(suggestion);
							}}
						>
							{suggestion}
						</button>
					{/each}
					
					<hr class="suggestion-divider" />
					
					<button 
						class="suggestion-ignore"
						onclick={(e) => {
							e.stopPropagation();
							handleIgnore();
						}}
					>
						Ignore
					</button>
				</div>
			{/if}
		{/if}
	</span>
</NodeViewWrapper>

<style>
	.suggestion-wrapper {
		display: inline;
		position: relative;
	}

	.suggestion-text {
		background-color: #fff3cd;
		border-bottom: 2px dotted #d97706;
		padding: 1px 2px;
		cursor: pointer;
		position: relative;
		border-radius: 2px;
		transition: background-color 0.2s ease;
		display: inline;
	}

	.suggestion-text:hover,
	.suggestion-active {
		background-color: #fef3c7;
	}

	.suggestion-indicator {
		font-size: 0.8em;
		color: #d97706;
		margin-left: 2px;
	}

	.suggestion-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 1000;
		min-width: 150px;
		max-width: 250px;
		padding: 4px 0;
		margin-top: 2px;
	}

	.suggestion-header {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		padding: 4px 12px;
		border-bottom: 1px solid #f3f4f6;
		margin-bottom: 2px;
	}

	.suggestion-option {
		display: block;
		width: 100%;
		text-align: left;
		padding: 6px 12px;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.875rem;
		color: #374151;
		transition: background-color 0.1s ease;
	}

	.suggestion-option:hover {
		background-color: #f3f4f6;
	}

	.suggestion-divider {
		margin: 4px 0;
		border: none;
		border-top: 1px solid #e5e7eb;
	}

	.suggestion-ignore {
		display: block;
		width: 100%;
		text-align: left;
		padding: 6px 12px;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.875rem;
		color: #6b7280;
		font-style: italic;
		transition: background-color 0.1s ease;
	}

	.suggestion-ignore:hover {
		background-color: #fef2f2;
		color: #dc2626;
	}

	/* Prevent text selection on the suggestion element */
	.suggestion-text {
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
	}

	/* Ensure the NodeView doesn't interfere with inline layout */
	:global(.suggestion-wrapper) {
		display: inline !important;
	}
</style> 