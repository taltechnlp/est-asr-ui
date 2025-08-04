<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import spinner from 'svelte-awesome/icons/spinner';
	import check from 'svelte-awesome/icons/check';
	import exclamationTriangle from 'svelte-awesome/icons/exclamationTriangle';
	import flask from 'svelte-awesome/icons/flask';
	import times from 'svelte-awesome/icons/times';
	import wrench from 'svelte-awesome/icons/wrench';
	import refresh from 'svelte-awesome/icons/refresh';
	import type { AnalysisSegment, TranscriptSummary } from '@prisma/client';
	import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
	import { _ } from 'svelte-i18n';
	import { clickOutside } from '../clickOutside';
	import Portal from '../Portal.svelte';
	import { getCoordinatingAgentClient } from '$lib/agents/coordinatingAgentClient';

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
	let applyingStates = $state<Record<number, boolean>>({});
	let isReanalyzing = $state(false);

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

	async function reanalyzeSegment() {
		if (!summary) {
			error = 'Please generate a summary first';
			return;
		}

		isReanalyzing = true;
		error = null;

		try {
			// Delete existing analysis from database first
			const deleteResponse = await fetch(`/api/transcript-analysis/segments/${fileId}/${segment.index}`, {
				method: 'DELETE'
			});
			
			if (!deleteResponse.ok) {
				console.warn('Failed to delete existing analysis, continuing with re-analysis');
			}

			// Perform fresh analysis
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
				throw new Error(errorData.error || 'Re-analysis failed');
			}

			const result = await response.json();
			analysisResult = result.analysisSegment;
			analysisStatus = 'analyzed';
			
			// Reset applying states since we have new suggestions
			applyingStates = {};
			
			onAnalysisComplete(result);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to re-analyze segment';
			console.error('Segment re-analysis error:', err);
		} finally {
			isReanalyzing = false;
		}
	}

	async function applySuggestion(suggestion: any, index: number) {
		applyingStates[index] = true;
		
		try {
			const agent = getCoordinatingAgentClient();
			const result = await agent.applySuggestionManually(
				suggestion,
				segment.speakerName || segment.speakerTag
			);
			
			if (result.success) {
				// Update the suggestion to show it was applied
				if (analysisResult && analysisResult.suggestions && Array.isArray(analysisResult.suggestions)) {
					const updatedSuggestions = [...(analysisResult.suggestions as any[])];
					updatedSuggestions[index] = {
						...suggestion,
						applied: true,
						appliedAt: (result as any).appliedAt,
						transactionId: (result as any).transactionId
					};
					analysisResult = {
						...analysisResult,
						suggestions: updatedSuggestions
					};
				}
			} else {
				console.error('Failed to apply suggestion:', result.error);
				alert(`Failed to apply suggestion: ${result.error}`);
			}
		} catch (error) {
			console.error('Error applying suggestion:', error);
			alert('Failed to apply suggestion. Please try again.');
		} finally {
			applyingStates[index] = false;
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
					{analysisResult.suggestions.length} {$_('transcript.analysis.suggestionCount')}
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
				<div class="header-actions">
					<button 
						class="reanalyze-btn" 
						onclick={reanalyzeSegment}
						disabled={isReanalyzing}
						title={$_('transcript.analysis.reanalyze')}
					>
						{#if isReanalyzing}
							<Icon data={spinner} spin scale={0.8} />
						{:else}
							<Icon data={refresh} scale={0.8} />
						{/if}
						<span>{isReanalyzing ? $_('transcript.analysis.reanalyzing') : $_('transcript.analysis.reanalyze')}</span>
					</button>
					<button class="close-btn" onclick={() => showResults = false}>
						<Icon data={times} />
					</button>
				</div>
			</div>
			
			<div class="results-content">
				
				{#if analysisResult.suggestions && Array.isArray(analysisResult.suggestions) && analysisResult.suggestions.length > 0}
					<div class="suggestions-section">
						<h5>{$_('transcript.analysis.suggestions')} ({analysisResult.suggestions.length})</h5>
						{#each (analysisResult.suggestions as any[]) as suggestion, index}
							<div class="suggestion-item">
								<div class="suggestion-header">
									<span class="suggestion-type">{suggestion?.type || 'Unknown'}</span>
									<div class="suggestion-header-right">
										<span 
											class="suggestion-severity" 
											style="color: {getSeverityColor(suggestion?.severity || 'low')}"
										>
											{suggestion?.severity || 'low'}
										</span>
										{#if suggestion?.applied}
											<span class="applied-badge">Applied</span>
										{:else if suggestion?.originalText && suggestion?.suggestedText}
											<button 
												class="apply-suggestion-btn"
												onclick={() => applySuggestion(suggestion, index)}
												disabled={applyingStates[index]}
											>
												{#if applyingStates[index]}
													<Icon data={spinner} spin scale={0.7} />
												{:else}
													<Icon data={wrench} scale={0.7} />
												{/if}
												<span>{applyingStates[index] ? 'Applying...' : 'Apply'}</span>
											</button>
										{/if}
									</div>
								</div>
								<p class="suggestion-text">{suggestion?.text || suggestion?.explanation || 'No description'}</p>
								{#if suggestion?.originalText && suggestion?.suggestedText}
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
				{:else}
					<div class="no-suggestions">
						<p>{$_('transcript.analysis.noSuggestions')}</p>
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
		gap: 0.25rem;
		margin-left: 0;
		vertical-align: middle;
		position: relative;
	}

	.analysis-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		font-size: 0.625rem;
		font-weight: 500;
		border: 1px solid #e5e7eb;
		background: white;
		color: #6b7280;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		height: 1.75rem;
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
		font-size: 0.625rem;
	}

	.analysis-summary {
		font-size: 0.625rem;
		color: #6b7280;
	}

	.suggestion-count {
		padding: 0.0625rem 0.375rem;
		background: #f3f4f6;
		border-radius: 0.25rem;
		font-size: 0.625rem;
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

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	.reanalyze-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		border: 1px solid #e5e7eb;
		background: white;
		color: #6b7280;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.reanalyze-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #d1d5db;
		color: #374151;
	}

	.reanalyze-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.results-content {
		padding: 1rem;
	}

	.analysis-section,
	.suggestions-section,
	.no-suggestions {
		margin-bottom: 1.5rem;
	}

	.analysis-section:last-child,
	.suggestions-section:last-child,
	.no-suggestions:last-child {
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

	.no-suggestions {
		text-align: center;
		padding: 2rem 1rem;
	}

	.no-suggestions p {
		margin: 0;
		color: #6b7280;
		font-size: 0.875rem;
		font-style: italic;
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
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.suggestion-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	.apply-suggestion-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		border: 1px solid #3b82f6;
		background: #eff6ff;
		color: #3b82f6;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.apply-suggestion-btn:hover:not(:disabled) {
		background: #dbeafe;
		border-color: #2563eb;
		color: #2563eb;
	}

	.apply-suggestion-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.applied-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: #10b981;
		background: #f0fdf4;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		border: 1px solid #10b981;
	}

	@media (max-width: 640px) {
		.analysis-results-popup {
			min-width: unset;
			left: -50px;
			right: -50px;
		}
		
		.header-actions {
			flex-direction: column;
			gap: 0.25rem;
		}
		
		.reanalyze-btn span {
			display: none;
		}
		
		.reanalyze-btn {
			padding: 0.25rem 0.5rem;
		}
		
		.suggestion-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
		
		.suggestion-header-right {
			align-self: flex-end;
		}
	}
</style>