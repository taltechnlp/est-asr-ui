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
		transcription = json; // Set the transcription to the full JSON structure
		
		if (json.content && Array.isArray(json.content)) {
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
				
				if (node.attrs) {
					speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
				}
				
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
		}
	} else {
		transcription = json || {type: 'doc', content: []}; // empty editor;
	}
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
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 100vh;
		padding-bottom: 120px; /* Space for fixed audio player */
	}
	
	.content-area {
		display: grid;
		grid-template-columns: 1fr 400px;
		transition: grid-template-columns 0.3s ease;
		flex: 1;
	}
	
	.transcript-layout.sidebar-collapsed .content-area {
		grid-template-columns: 1fr 48px;
	}
	
	.editor-pane {
		background: #f8f9fa; /* Light gray background to match top sections */
	}
	
	.editor-content {
		background: #f8f9fa; /* Light gray background to match top sections */
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
			padding-bottom: 140px; /* More space for player on mobile */
		}
	}
</style>
