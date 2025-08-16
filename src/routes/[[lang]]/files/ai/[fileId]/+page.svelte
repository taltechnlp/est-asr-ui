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
	import type { TranscriptSummary } from '@prisma/client';
	let { data } = $props();
	let words = $state<Array<Word>>([]);
	let speakers = $state<Array<Speaker>>([]);
	let transcription = $state('');
	let json = JSON.parse(data.file && data.file.content);
	let summary = $state<TranscriptSummary | null>(null);
	let sidebarCollapsed = $state(false);
	let content;
	// First time transcription from the Estonian JSON format.
	if (json && !json.type) {
		content = fromEstFormatAI(json);  // Use AI converter for Word nodes
		({ transcription, words, speakers } = content);
	}
	// Already in Editor format - need to handle Word nodes
	else if (json && json.content) {
		json.content.forEach((node) => {
			// Extract timing from first and last Word nodes
			let start = -1;
			let end = -1;
			
			if (node.content && node.content.length > 0) {
				// Find first Word node
				const firstWordNode = node.content.find(n => n.type === 'wordNode');
				if (firstWordNode && firstWordNode.attrs) {
					start = firstWordNode.attrs.start || -1;
				}
				
				// Find last Word node
				const lastWordNode = [...node.content].reverse().find(n => n.type === 'wordNode');
				if (lastWordNode && lastWordNode.attrs) {
					end = lastWordNode.attrs.end || -1;
				}
			}
			
			speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
			
			if (node.content) {
				node.content.forEach((inlineNode) => {
					// Extract word timing from Word nodes
					if (inlineNode.type === 'wordNode' && inlineNode.attrs) {
						words.push({ 
							start: inlineNode.attrs.start, 
							end: inlineNode.attrs.end, 
							id: inlineNode.attrs.id 
						});
					}
				});
			}
		});
		transcription = json;
	} else transcription = json; // empty editor;
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words);
	
	function handleSummaryGenerated(newSummary: TranscriptSummary) {
		summary = newSummary;
	}
</script>

<main class="transcript-layout {sidebarCollapsed ? 'sidebar-collapsed' : ''}">
	<div class="content-area">
		<div class="editor-pane">
			<div class="editor-content">
				<TiptapAI
					content={transcription}
					fileId={data.file.id}
					demo={false}
					fileName={data.file.name}
					uploadedAt={data.file.uploadedAt}
					{summary}
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
	.transcript-layout {
		display: grid;
		grid-template-rows: 1fr auto; /* Content area takes remaining space, player area auto-sized */
		height: 100vh;
		width: 100%;
		overflow: hidden;
	}
	
	.content-area {
		display: grid;
		grid-template-columns: 1fr 400px;
		overflow: hidden;
		transition: grid-template-columns 0.3s ease;
		min-height: 0; /* Allow content to shrink */
	}
	
	.transcript-layout.sidebar-collapsed .content-area {
		grid-template-columns: 1fr 48px;
	}
	
	.editor-pane {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0; /* Allow content to shrink */
	}
	
	.editor-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0; /* Allow content to shrink */
	}
	
	.player-area {
		border-top: 1px solid #e5e7eb;
		background: white;
		z-index: 10;
	}
	
	/* Responsive layout */
	@media (max-width: 1024px) {
		.content-area {
			grid-template-columns: 1fr;
		}
		
		.transcript-layout.sidebar-collapsed .content-area {
			grid-template-columns: 1fr;
		}
	}
</style>
