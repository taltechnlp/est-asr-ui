<script lang="ts">
	import TiptapAI from '$lib/components/editor/TiptapAI.svelte';  // Use AI-specific editor
	import Player from '$lib/components/Player.svelte';
	import { fromDelta } from '$lib/helpers/converters/deltaFormat';
	import { fromEstFormatAI } from '$lib/helpers/converters/estFormatAI';  // Use AI-specific converter
	import {
		speakerNames as speakerNamesStore,
		words as wordsStore,
		editorMounted
	} from '$lib/stores.svelte.js';
	import type { Word, Speaker } from '$lib/helpers/converters/types';
	import TranscriptSidebar from '$lib/components/transcript-sidebar/TranscriptSidebar.svelte';
	import SummaryAccordion from '$lib/components/transcript-summary/SummaryAccordion.svelte';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import chevronLeft from 'svelte-awesome/icons/chevronLeft';
	import type { TranscriptSummary } from '@prisma/client';
	let { data } = $props();
	let words = $state<Array<Word>>([]);
	let speakers = $state<Array<Speaker>>([]);
	let transcription = $state('');
	let timingArray = $state([]);
	let json = JSON.parse(data.file && data.file.content);
	let summary = $state<TranscriptSummary | null>(null);
	let sidebarCollapsed = $state(false);
	let content;

	// First time transcription from the Estonian JSON format.
	if (json && !json.type) {
		console.log('[Page] Loading from EST format JSON');
		content = fromEstFormatAI(json);  // Use AI converter for Word nodes
		({ transcription, words, speakers, timingArray } = content);
		console.log('[Page] TimingArray from EST format:', timingArray.length, 'entries');
	}
	// Already in Editor format - need to handle Word nodes
	else if (json && json.content) {
		console.log('[Page] Loading from Editor format JSON');
		transcription = json; // Set the transcription to the full JSON structure

		// If there's a stored timingArray in the JSON, use it
		if (json.timingArray) {
			timingArray = json.timingArray;
			console.log('[Page] Using stored timingArray:', timingArray.length, 'entries');
		}

		// Recovery: If no timingArray but we have originalAsrData, reconstruct from it
		if (!timingArray.length && data.file.originalAsrData) {
			console.log('[Page] No timingArray found, attempting recovery from originalAsrData');
			try {
				const originalJson = JSON.parse(data.file.originalAsrData);
				if (originalJson && !originalJson.type) {
					const originalContent = fromEstFormatAI(originalJson);
					timingArray = originalContent.timingArray;
					console.log('[Page] Recovered timingArray:', timingArray.length, 'entries');
				}
			} catch (e) {
				console.error('[Page] Failed to recover timingArray from originalAsrData:', e);
			}
		}

		// Migration: Add wordIndex to word nodes that don't have it
		if (timingArray.length > 0 && json.content && Array.isArray(json.content)) {
			let wordIndex = 0;
			let migrationCount = 0;

			json.content.forEach((node) => {
				if (node.content && Array.isArray(node.content)) {
					node.content.forEach((inlineNode) => {
						if (inlineNode.type === 'wordNode') {
							// If word node doesn't have wordIndex, add it
							if (inlineNode.attrs && (inlineNode.attrs.wordIndex === undefined || inlineNode.attrs.wordIndex === null)) {
								if (!inlineNode.attrs) inlineNode.attrs = {};
								inlineNode.attrs.wordIndex = wordIndex;
								migrationCount++;
								wordIndex++;
							} else if (inlineNode.attrs && inlineNode.attrs.wordIndex !== undefined) {
								wordIndex = Math.max(wordIndex, inlineNode.attrs.wordIndex + 1);
							}
						}
					});
				}
			});

			if (migrationCount > 0) {
				console.log('[Page] Migrated', migrationCount, 'word nodes with wordIndex attributes');
			}
		}

		if (json.content && Array.isArray(json.content)) {
			json.content.forEach((node) => {
				// Extract timing from first and last Word nodes (or from timingArray)
				let start = -1;
				let end = -1;

				if (node.content && node.content.length > 0) {
					// Find first Word node
					const firstWordNode = node.content.find(n => n.type === 'wordNode');
					if (firstWordNode && firstWordNode.attrs) {
						// New format: use wordIndex to look up timing
						if (firstWordNode.attrs.wordIndex !== undefined && timingArray[firstWordNode.attrs.wordIndex]) {
							start = timingArray[firstWordNode.attrs.wordIndex].start;
						}
						// Legacy format: use stored start/end
						else if (firstWordNode.attrs.start !== undefined) {
							start = firstWordNode.attrs.start;
						}
					}

					// Find last Word node
					const lastWordNode = [...node.content].reverse().find(n => n.type === 'wordNode');
					if (lastWordNode && lastWordNode.attrs) {
						// New format: use wordIndex to look up timing
						if (lastWordNode.attrs.wordIndex !== undefined && timingArray[lastWordNode.attrs.wordIndex]) {
							end = timingArray[lastWordNode.attrs.wordIndex].end;
						}
						// Legacy format: use stored start/end
						else if (lastWordNode.attrs.end !== undefined) {
							end = lastWordNode.attrs.end;
						}
					}
				}

				if (node.attrs) {
					speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
				}

				if (node.content) {
					node.content.forEach((inlineNode) => {
						// Extract word timing from Word nodes
						if (inlineNode.type === 'wordNode' && inlineNode.attrs) {
							// New format: use wordIndex to look up timing
							if (inlineNode.attrs.wordIndex !== undefined && timingArray[inlineNode.attrs.wordIndex]) {
								words.push({
									start: timingArray[inlineNode.attrs.wordIndex].start,
									end: timingArray[inlineNode.attrs.wordIndex].end,
									id: inlineNode.attrs.wordIndex.toString()
								});
							}
							// Legacy format: use stored start/end
							else if (inlineNode.attrs.start !== undefined && inlineNode.attrs.end !== undefined) {
								words.push({
									start: inlineNode.attrs.start,
									end: inlineNode.attrs.end,
									id: inlineNode.attrs.id
								});
								// Build timingArray from legacy data
								timingArray.push({ start: inlineNode.attrs.start, end: inlineNode.attrs.end });
							}
						}
					});
				}
			});
		}
		console.log('[Page] Final timingArray length:', timingArray.length);
		console.log('[Page] Words array length:', words.length);
	} else {
		transcription = json || {type: 'doc', content: []}; // empty editor;
	}
	console.log('[Page] Passing timingArray to TiptapAI:', timingArray.length, 'entries');
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words);
	
	function handleSummaryGenerated(newSummary: TranscriptSummary) {
		summary = newSummary;
	}

	// Listen for openTranscriptSidebar events from inline segment controls
	$effect(() => {
		const onOpen = () => {
			// Only react if currently collapsed
			sidebarCollapsed = false;
		};
		window.addEventListener('openTranscriptSidebar', onOpen);
		return () => window.removeEventListener('openTranscriptSidebar', onOpen);
	});

	// Broadcast sidebar collapsed state so inline controls can adapt
	$effect(() => {
		window.dispatchEvent(new CustomEvent('transcriptSidebarCollapsed', { detail: { collapsed: sidebarCollapsed } }));
	});
</script>

<main class="transcript-layout {sidebarCollapsed ? 'sidebar-collapsed' : ''}">
	<div class="content-area">
		<div class="editor-pane">
			<div class="editor-content">
				{#if sidebarCollapsed}
					<div class="expand-sidebar-stick">
						<button class="expand-sidebar-btn" title="Open sidebar" onclick={() => (sidebarCollapsed = false)}>
							<Icon data={chevronLeft} />
						</button>
					</div>
				{/if}
				<TiptapAI
					content={transcription}
					fileId={data.file.id}
					demo={false}
					fileName={data.file.name}
					uploadedAt={data.file.uploadedAt}
					{summary}
					{timingArray}
					onSummaryGenerated={handleSummaryGenerated}
				/>
			</div>
		</div>
		
		<TranscriptSidebar
			fileId={data.file.id}
			editorContent={json}
			audioFilePath={data.file.path}
			{summary}
			collapsed={sidebarCollapsed}
			onCollapsedChange={(value) => sidebarCollapsed = value}
			onSegmentAnalyzed={(result) => {
				// Handle segment analysis results
				console.log('Segment analyzed:', result);
			}}
		/>
	</div>

	<div class="player-area">
		<Player url={`${data.url}/uploaded/${data.file.id}`} />
	</div>
</main>

<style>
	:root {
		/* default; will be updated by Player via ResizeObserver */
		--player-height: 140px;
		--sidebar-width: clamp(320px, 28vw, 420px);
	}
	.transcript-layout {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 100vh;
		padding-bottom: var(--player-height, 140px); /* Space for fixed audio player */
	}
	
	.content-area {
		display: grid;
		grid-template-columns: 1fr var(--sidebar-width);
		transition: grid-template-columns 0.2s ease;
		flex: 1;
		gap: 0; /* no gap to keep player full width alignment */
	}
	
	.transcript-layout.sidebar-collapsed .content-area {
		grid-template-columns: 1fr; /* remove sidebar column entirely when collapsed */
	}
	
	.editor-pane {
		background: #f8f9fa;
	}
	
	.editor-content {
		background: #f8f9fa;
		position: relative; /* container for the editor */
	}

	/* Sticky expand control aligned to the right edge of editor */
	.expand-sidebar-stick {
		position: sticky;
		top: 12px;
		z-index: 900; /* below player */
		display: flex;
		justify-content: flex-end;
		pointer-events: none; /* avoid intercepting selection in editor */
	}
	.expand-sidebar-btn {
		pointer-events: auto; /* clickable */
		margin-right: 8px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 9999px;
		padding: 8px;
		box-shadow: 0 2px 6px rgba(0,0,0,0.12);
		cursor: pointer;
		animation: expandPulse 1600ms ease-out 1;
	}
	@keyframes expandPulse {
		0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
		50% { transform: scale(1.06); box-shadow: 0 0 0 8px rgba(59,130,246,0.08); }
		100% { transform: scale(1); box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
	}
	
	.player-area {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		border-top: 1px solid #e5e7eb;
		background: white;
		z-index: 1000;
	}

	/* Responsive layout */
	@media (max-width: 1024px) {
		.content-area {
			grid-template-columns: 1fr;
		}
		
		.transcript-layout.sidebar-collapsed .content-area {
			grid-template-columns: 1fr;
		}
		
		.transcript-layout {
			padding-bottom: var(--player-height, 160px);
		}
	}
</style>
