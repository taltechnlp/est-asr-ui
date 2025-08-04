<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import spinner from 'svelte-awesome/icons/spinner';
	import check from 'svelte-awesome/icons/check';
	import exclamationTriangle from 'svelte-awesome/icons/exclamationTriangle';
	import flask from 'svelte-awesome/icons/flask';
	import times from 'svelte-awesome/icons/times';
	import type { AnalysisSegment, TranscriptSummary } from '@prisma/client';
	import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
	import { _ } from 'svelte-i18n';
	import { clickOutside } from '../clickOutside';
	import Portal from '../Portal.svelte';

	interface Props {
		fileId: string;
		segment: SegmentWithTiming;
		audioFilePath: string;
		onAnalysisComplete?: (result: any) => void;
	}

	let { 
		fileId, 
		segment, 
		audioFilePath,
		onAnalysisComplete = () => {}
	}: Props = $props();

	let isAnalyzing = $state(false);
	let error = $state<string | null>(null);
	let analysisStatus = $state<'pending' | 'analyzing' | 'analyzed' | 'error'>('pending');
	let analysisResult = $state<AnalysisSegment | null>(null);
	let summary = $state<TranscriptSummary | null>(null);
	let showResults = $state(false);
	let buttonElement = $state<HTMLButtonElement | null>(null);
	let popupPosition = $state({ top: 0, left: 0 });
	let popupMaxHeight = $state(400);

	// Handle escape key
	$effect(() => {
		if (!showResults) return;
		
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				showResults = false;
			}
		};
		
		document.addEventListener('keydown', handleEscape);
		
		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	});

	// Check if this segment has been analyzed before
	onMount(async () => {
		await checkExistingAnalysis();
		await loadSummary();
	});

	async function checkExistingAnalysis() {
		try {
			const response = await fetch(`/api/transcript-analysis/segments/${fileId}/`);
			if (response.ok) {
				const segments = await response.json();
				const existingAnalysis = segments.find((s: AnalysisSegment) => 
					s.segmentIndex === segment.index
				);
				
				if (existingAnalysis) {
					analysisResult = existingAnalysis;
					analysisStatus = 'analyzed';
				}
			}
		} catch (err) {
			console.error('Failed to check existing analysis:', err);
		}
	}

	async function loadSummary() {
		try {
			const response = await fetch(`/api/transcript-summary/${fileId}`);
			if (response.ok) {
				summary = await response.json();
			}
		} catch (err) {
			console.error('Failed to load summary:', err);
		}
	}

	async function handleButtonClick() {
		if (analysisStatus === 'analyzed' && analysisResult) {
			// Calculate popup position when showing
			if (buttonElement && !showResults) {
				const rect = buttonElement.getBoundingClientRect();
				const popupWidth = 400; // min-width of popup
				const popupHeight = 400; // max-height of popup
				const margin = 20; // margin from viewport edges
				
				let left = rect.left + window.scrollX;
				let top = rect.bottom + window.scrollY + 8;
				
				// Check if popup would go beyond viewport bottom
				const popupBottom = rect.bottom + 8 + popupHeight;
				const viewportBottom = window.innerHeight;
				
				if (popupBottom > viewportBottom - margin) {
					// Try to position above the button
					const popupTop = rect.top - popupHeight - 8;
					
					if (popupTop >= margin) {
						// Enough space above
						top = rect.top + window.scrollY - popupHeight - 8;
						popupMaxHeight = popupHeight;
					} else {
						// Not enough space above either, position at top of viewport with margin
						top = window.scrollY + margin;
						// Calculate available height from top position to bottom of viewport
						const availableHeight = viewportBottom - margin - (top - window.scrollY);
						popupMaxHeight = Math.min(popupHeight, availableHeight);
					}
				} else {
					// Enough space below, but still check if we need to limit height
					const availableHeight = viewportBottom - margin - rect.bottom - 8;
					popupMaxHeight = Math.min(popupHeight, availableHeight);
				}
				
				// Check right boundary
				if (left + popupWidth > window.innerWidth - margin) {
					left = Math.max(margin, window.innerWidth - popupWidth - margin);
				}
				
				// Ensure minimum left position
				if (left < margin) {
					left = margin;
				}
				
				popupPosition = { top, left };
			}
			// Toggle showing results
			showResults = !showResults;
		} else if (analysisStatus === 'pending' || analysisStatus === 'error') {
			// Perform analysis
			await analyzeSegment();
		}
	}

	async function analyzeSegment() {
		if (!summary) {
			error = 'Please generate a summary first';
			return;
		}

		isAnalyzing = true;
		analysisStatus = 'analyzing';
		error = null;

		try {
			const response = await fetch('/api/transcript-analysis/segment', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					fileId,
					segment,
					summaryId: summary.id,
					audioFilePath,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Analysis failed');
			}

			const result = await response.json();
			analysisResult = result.analysisSegment;
			analysisStatus = 'analyzed';
			
			onAnalysisComplete(result);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to analyze segment';
			analysisStatus = 'error';
			console.error('Segment analysis error:', err);
		} finally {
			isAnalyzing = false;
		}
	}

	function getButtonClass() {
		const baseClass = "analysis-btn";
		switch (analysisStatus) {
			case 'analyzed':
				return `${baseClass} analyzed`;
			case 'analyzing':
				return `${baseClass} analyzing`;
			case 'error':
				return `${baseClass} error`;
			default:
				return baseClass;
		}
	}

	function getButtonTitle() {
		switch (analysisStatus) {
			case 'analyzed':
				return $_('transcript.analysis.viewAnalysis');
			case 'analyzing':
				return $_('transcript.analysis.analyzing');
			case 'error':
				return error || $_('transcript.analysis.error');
			default:
				return $_('transcript.analysis.analyzeSegment');
		}
	}

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'high': return '#dc2626';
			case 'medium': return '#f59e0b';
			case 'low': return '#10b981';
			default: return '#6b7280';
		}
	}
</script>

<div class="segment-analysis-container" contentEditable={false}>
	<button
		bind:this={buttonElement}
		class={getButtonClass()}
		onclick={handleButtonClick}
		disabled={isAnalyzing}
		title={getButtonTitle()}
	>
		{#if analysisStatus === 'analyzing'}
			<Icon data={spinner} spin />
		{:else if analysisStatus === 'analyzed'}
			<Icon data={check} />
		{:else if analysisStatus === 'error'}
			<Icon data={exclamationTriangle} />
		{:else}
			<Icon data={flask} />
		{/if}
		
		<span class="btn-text">
			{#if analysisStatus === 'analyzing'}
				{$_('transcript.analysis.analyzing')}
			{:else if analysisStatus === 'analyzed'}
				{$_('transcript.analysis.analyzed')}
			{:else if analysisStatus === 'error'}
				{$_('common.error')}
			{:else}
				{$_('transcript.analysis.analyze')}
			{/if}
		</span>
	</button>

	{#if analysisResult && analysisStatus === 'analyzed'}
		<div class="analysis-summary">
			{#if analysisResult.suggestions && Array.isArray(analysisResult.suggestions)}
				<span class="suggestion-count">
					{analysisResult.suggestions.length} {$_('transcript.analysis.suggestions')}
				</span>
			{/if}
		</div>
	{/if}
	
</div>

{#if showResults && analysisResult}
	<Portal>
		<div 
			class="analysis-results-popup" 
			style="top: {popupPosition.top}px; left: {popupPosition.left}px; max-height: {popupMaxHeight}px;"
			use:clickOutside
			onoutclick={() => showResults = false}
		>
			<div class="results-header">
				<h4>{$_('transcript.analysis.results')}</h4>
				<button class="close-btn" onclick={() => showResults = false}>
					<Icon data={times} />
				</button>
			</div>
			
			<div class="results-content">
				{#if analysisResult.analysis}
					<div class="analysis-section">
						<h5>{$_('transcript.analysis.analysis')}</h5>
						<p>{analysisResult.analysis}</p>
					</div>
				{/if}
				
				{#if analysisResult.suggestions && Array.isArray(analysisResult.suggestions) && analysisResult.suggestions.length > 0}
					<div class="suggestions-section">
						<h5>{$_('transcript.analysis.suggestions')} ({analysisResult.suggestions.length})</h5>
						{#each analysisResult.suggestions as suggestion}
							<div class="suggestion-item">
								<div class="suggestion-header">
									<span class="suggestion-type">{suggestion.type}</span>
									<span 
										class="suggestion-severity" 
										style="color: {getSeverityColor(suggestion.severity)}"
									>
										{suggestion.severity}
									</span>
								</div>
								<p class="suggestion-text">{suggestion.text || suggestion.explanation}</p>
								{#if suggestion.originalText && suggestion.suggestedText}
									<div class="suggestion-changes">
										<div class="original">
											<strong>{$_('transcript.suggestion.original')}:</strong> {suggestion.originalText}
										</div>
										<div class="suggested">
											<strong>{$_('transcript.suggestion.suggested')}:</strong> {suggestion.suggestedText}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</Portal>
{/if}

<style>
	.segment-analysis-container {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: 1rem;
		vertical-align: middle;
		position: relative;
	}

	.analysis-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		border: 1px solid #e5e7eb;
		background: white;
		color: #6b7280;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.analysis-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #d1d5db;
		color: #374151;
	}

	.analysis-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.analysis-btn.analyzing {
		background: #eff6ff;
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.analysis-btn.analyzed {
		background: #f0fdf4;
		border-color: #10b981;
		color: #10b981;
	}

	.analysis-btn.error {
		background: #fef2f2;
		border-color: #ef4444;
		color: #ef4444;
	}

	.btn-text {
		font-size: 0.75rem;
	}

	.analysis-summary {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.suggestion-count {
		padding: 0.125rem 0.5rem;
		background: #f3f4f6;
		border-radius: 0.25rem;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.btn-text {
			display: none;
		}
		
		.analysis-btn {
			padding: 0.25rem 0.5rem;
		}
	}

	/* Analysis Results Popup */
	.analysis-results-popup {
		position: fixed;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		max-height: 400px;
		overflow-y: auto;
		min-width: 400px;
		opacity: 1 !important;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
		position: sticky;
		top: 0;
		background: white;
		z-index: 10;
	}

	.results-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: #6b7280;
		transition: color 0.2s;
	}

	.close-btn:hover {
		color: #374151;
	}

	.results-content {
		padding: 1rem;
	}

	.analysis-section,
	.suggestions-section {
		margin-bottom: 1.5rem;
	}

	.analysis-section:last-child,
	.suggestions-section:last-child {
		margin-bottom: 0;
	}

	.analysis-section h5,
	.suggestions-section h5 {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #4b5563;
	}

	.analysis-section p {
		margin: 0;
		line-height: 1.6;
		color: #374151;
		font-size: 0.875rem;
	}

	.suggestion-item {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.suggestion-item:last-child {
		margin-bottom: 0;
	}

	.suggestion-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.suggestion-type {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: #6b7280;
	}

	.suggestion-severity {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.suggestion-text {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #374151;
	}

	.suggestion-changes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e5e7eb;
	}

	.original,
	.suggested {
		font-size: 0.875rem;
		color: #374151;
	}

	.original strong,
	.suggested strong {
		color: #4b5563;
		font-weight: 600;
	}

	@media (max-width: 640px) {
		.analysis-results-popup {
			min-width: unset;
			left: -50px;
			right: -50px;
		}
	}
</style>