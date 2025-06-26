<script lang="ts">
	import Tiptap from '$lib/components/editor/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
	import { fromDelta } from '$lib/helpers/converters/deltaFormat';
	import { fromEstFormat } from '$lib/helpers/converters/estFormat';
	import {
		speakerNames as speakerNamesStore,
		words as wordsStore,
		editorMounted
	} from '$lib/stores.svelte.js';
	import type { Word, Speaker } from '$lib/helpers/converters/types';
	import { onMount } from 'svelte';

	let { data } = $props();
	let words: Array<Word> = [];
	let speakers: Array<Speaker> = [];
	
	// Add defensive programming for content parsing
	let json;
	let content;
	let transcription = $state();
	
	try {
		json = JSON.parse(data.file && data.file.content);
	} catch (error) {
		console.error('Error parsing file content:', error);
		json = null;
	}
	
	// Transcript refinement state
	let refinementStatus = $state<'idle' | 'loading' | 'completed' | 'error'>('idle');
	let refinementResult = $state<any>(null);
	let refinementError = $state<string>('');
	let showCorrections = $state(false);

	// First time transcription from the Estonian JSON format.
	if (json && !json.type) {
		content = fromEstFormat(json);
		transcription = content.transcription;
		words = content.words;
		speakers = content.speakers;
	}
	// Already in Editor format
	else if (json && json.content) {
		json.content.forEach((node) => {
			const start =
				node.content &&
				node.content[0] &&
				node.content[0].marks &&
				node.content[0].marks[0] &&
				node.content[0].marks[0].attrs &&
				node.content[0].marks[0].attrs.start
					? node.content[0].marks[0].attrs.start
					: -1;
			const end =
				node.content && node.content[node.content.length-1] && node.content[node.content.length-1].marks && node.content[node.content.length-1].marks[0].attrs.end
				? node.content[node.content.length-1].marks[0].attrs.end
				: -1;
			speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
			if (node.content) {
				node.content.forEach((inlineNode) => {
					if (inlineNode.type === 'text' && inlineNode.marks && inlineNode.marks.length > 0) {
						inlineNode.marks.forEach((mark) => {
							if (mark.type == 'word') {
								words.push({ start: mark.attrs.start, end: mark.attrs.end, id: mark.attrs.id });
							}
						});
					}
				});
			}
		});
		transcription = json;
	} else {
		// Provide a safe default for empty or invalid content
		transcription = {
			type: 'doc',
			content: []
		};
	}
	
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words);

	// Function to trigger transcript refinement
	async function triggerTranscriptRefinement() {
		if (refinementStatus === 'loading') return;
		
		refinementStatus = 'loading';
		refinementError = '';
		
		try {
			const response = await fetch('/api/agent/transcript-refinement', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					fileId: data.file.id
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			
			if (result.success) {
				refinementResult = result.result;
				refinementStatus = 'completed';
				console.log('Transcript refinement completed:', result.result);
			} else {
				throw new Error(result.error || 'Unknown error occurred');
			}
		} catch (error) {
			console.error('Error during transcript refinement:', error);
			refinementError = error instanceof Error ? error.message : 'Unknown error occurred';
			refinementStatus = 'error';
		}
	}

	// Trigger refinement when page loads
	onMount(() => {
		// Add a small delay to ensure the page is fully loaded
		setTimeout(() => {
			triggerTranscriptRefinement();
		}, 1000);
	});
</script>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<!-- Transcript Refinement Status -->
		{#if refinementStatus === 'loading'}
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
				<div class="flex items-center">
					<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
					<span class="text-blue-800">Analyzing transcript with AI agent...</span>
				</div>
			</div>
		{:else if refinementStatus === 'completed' && refinementResult}
			<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<svg class="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
						</svg>
						<span class="text-green-800 font-medium">AI Analysis Complete</span>
					</div>
					<button 
						onclick={() => refinementStatus = 'idle'}
						class="text-green-600 hover:text-green-800 text-sm"
					>
						Hide
					</button>
				</div>
				
				<div class="mt-3 text-sm text-green-700">
					<p><strong>Summary:</strong> {refinementResult.totalSegments} segments analyzed, {refinementResult.segmentsWithIssues} with issues found</p>
					<p><strong>Processing time:</strong> {(refinementResult.processingTime / 1000).toFixed(1)}s</p>
					
					{#if refinementResult.summary.totalCorrections > 0}
						<div class="mt-2">
							<button 
								onclick={() => showCorrections = !showCorrections}
								class="text-green-600 hover:text-green-800 text-sm underline"
							>
								View {refinementResult.summary.totalCorrections} suggested corrections
							</button>
						</div>
					{/if}
				</div>

				<!-- Corrections Panel -->
				{#if showCorrections && refinementResult.segments}
					<div class="mt-4 border-t border-green-200 pt-4">
						<h4 class="font-medium text-green-800 mb-3">Suggested Corrections:</h4>
						<div class="space-y-3 max-h-64 overflow-y-auto">
							{#each refinementResult.segments.filter(s => s.corrections.length > 0) as segment}
								<div class="bg-white rounded border border-green-200 p-3">
									<p class="text-sm font-medium text-gray-800 mb-2">
										{segment.speaker}: "{segment.text}"
									</p>
									{#each segment.corrections as correction}
										<div class="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
											<div class="flex items-start justify-between">
												<div class="flex-1">
													<p class="text-xs text-gray-600 mb-1">
														<strong>Original:</strong> {correction.original}
													</p>
													<p class="text-xs text-gray-800 mb-1">
														<strong>Suggested:</strong> {correction.suggested}
													</p>
													<p class="text-xs text-gray-600">
														<strong>Reason:</strong> {correction.reasoning}
													</p>
												</div>
												<div class="text-right ml-2">
													<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
														{(correction.confidence * 100).toFixed(0)}%
													</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if refinementStatus === 'error'}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
				<div class="flex items-center">
					<svg class="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
					</svg>
					<span class="text-red-800">AI Analysis Failed: {refinementError}</span>
				</div>
				<button 
					onclick={triggerTranscriptRefinement}
					class="mt-2 text-red-600 hover:text-red-800 text-sm underline"
				>
					Retry Analysis
				</button>
			</div>
		{/if}

		{#if transcription && data.file}
			<Tiptap
				content={transcription}
				fileId={data.file.id}
				demo={false}
				fileName={data.file.name}
				uploadedAt={data.file.uploadedAt}
			/>
			<Player url={`${data.url}/uploaded/${data.file.id}`} />
		{:else}
			<div class="flex items-center justify-center h-64">
				<div class="text-center">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p class="text-gray-600">Loading transcript...</p>
				</div>
			</div>
		{/if}
	</div>
</main>
