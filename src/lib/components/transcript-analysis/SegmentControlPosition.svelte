<script lang="ts">
  import { onMount } from 'svelte';
  import type { AnalysisSegment, TranscriptSummary } from '@prisma/client';
  import type { TipTapEditorContent } from '../../../types';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import play from 'svelte-awesome/icons/play';
  import chevronLeft from 'svelte-awesome/icons/chevronLeft';
  import chevronRight from 'svelte-awesome/icons/chevronRight';
  import spinner from 'svelte-awesome/icons/spinner';
  import check from 'svelte-awesome/icons/check';
  import info from 'svelte-awesome/icons/infoCircle';
  import { _ } from 'svelte-i18n';
  import { getCoordinatingAgentPositionClient } from '$lib/agents/coordinatingAgentPositionClient';

  let {
    fileId = '',
    editorContent = null as TipTapEditorContent | null,
    audioFilePath = '',
    summary = null as TranscriptSummary | null,
    onSegmentAnalyzed = (result: any) => {},
  } = $props();

  let isAnalyzing = $state(false);
  let error = $state<string | null>(null);
  let showResults = $state(false);
  let currentAnalysis = $state<any | null>(null);
  let isInitialized = $state(false);
  let positionMethod = $state(true); // Use position-based by default
  let analysisStats = $state({
    totalSuggestions: 0,
    positionBased: 0,
    textBased: 0,
    applied: 0,
    failed: 0
  });

  const positionAgent = getCoordinatingAgentPositionClient();
  
  let pendingEditsSummary = $derived(getPendingEditsSummary());

  onMount(() => {
    loadAnalyzedSegments();
  });

  async function loadAnalyzedSegments() {
    if (!fileId) return;

    try {
      const response = await fetch(`/api/transcript-analysis/segments/${fileId}/`);
      if (response.ok) {
        const data = await response.json();
        // Process loaded segments if needed
        console.log('Loaded analyzed segments:', data.length);
      }
    } catch (err) {
      console.error('Failed to load analyzed segments:', err);
    }
  }

  async function analyzeWithPositions() {
    if (!summary || isAnalyzing || !editorContent) return;

    isAnalyzing = true;
    error = null;
    showResults = false;
    analysisStats = {
      totalSuggestions: 0,
      positionBased: 0,
      textBased: 0,
      applied: 0,
      failed: 0
    };

    try {
      // Extract segments with positions on client side
      const segments = positionAgent.extractSegments();
      console.log(`Extracted ${segments.length} position-aware segments`);

      const response = await fetch('/api/transcript-analysis/segment-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          editorContent,
          summaryId: summary.id,
          audioFilePath,
          usePositions: positionMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Position-based analysis failed');
      }

      const result = await response.json();
      
      // Update statistics
      if (result.suggestions && Array.isArray(result.suggestions)) {
        analysisStats.totalSuggestions = result.suggestions.length;
        
        result.suggestions.forEach((s: any) => {
          if (s.positionBased) {
            analysisStats.positionBased++;
          } else {
            analysisStats.textBased++;
          }
          
          if (s.applied) {
            analysisStats.applied++;
          } else if (s.error) {
            analysisStats.failed++;
          }
        });
      }
      
      currentAnalysis = result;
      showResults = true;
      
      onSegmentAnalyzed(result);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to analyze with positions';
      console.error('Position-based analysis error:', err);
    } finally {
      isAnalyzing = false;
    }
  }

  async function applySuggestion(suggestion: any) {
    try {
      const result = await positionAgent.applyPositionBasedSuggestion(suggestion);
      
      if (result.success) {
        console.log('Successfully applied suggestion:', result.diffId);
        // Update UI to show success
      } else {
        console.error('Failed to apply suggestion:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Error applying suggestion:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  function getPendingEditsSummary() {
    return positionAgent.getPendingEditsSummary();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

<div class="segment-control-position">
  <div class="control-header">
    <h3>{$_('transcript.analysis.positionBasedAnalysis')}</h3>
  </div>

  <div class="control-actions">
    <button
      class="analyze-btn primary"
      onclick={analyzeWithPositions}
      disabled={isAnalyzing || !summary}
    >
      {#if isAnalyzing}
        <Icon data={spinner} spin />
        {$_('transcript.analysis.analyzing')}
      {:else}
        {$_('transcript.analysis.analyzeAll')}
      {/if}
    </button>
  </div>

  {#if error}
    <div class="error-message">
      <p>{error}</p>
    </div>
  {/if}

  {#if showResults && currentAnalysis}
    <div class="analysis-results">
      <h4>{$_('transcript.analysis.results')}</h4>
      
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{analysisStats.totalSuggestions}</span>
          <span class="stat-label">{$_('transcript.analysis.totalSuggestions')}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{analysisStats.positionBased}</span>
          <span class="stat-label">{$_('transcript.analysis.positionBased')}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{analysisStats.applied}</span>
          <span class="stat-label">{$_('transcript.analysis.applied')}</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{analysisStats.failed}</span>
          <span class="stat-label">{$_('transcript.analysis.failed')}</span>
        </div>
      </div>

      <div class="analysis-content">
        <p>{currentAnalysis.analysis}</p>
      </div>

      {#if currentAnalysis.suggestions && currentAnalysis.suggestions.length > 0}
        <div class="suggestions-list">
          <h5>{$_('transcript.analysis.suggestions')}</h5>
          {#each currentAnalysis.suggestions as suggestion, idx}
            <div class="suggestion-item {suggestion.applied ? 'applied' : ''} {suggestion.error ? 'failed' : ''}">
              <div class="suggestion-header">
                <span class="suggestion-index">#{idx + 1}</span>
                {#if suggestion.positionBased}
                  <span class="position-badge">Position-based</span>
                {/if}
                {#if suggestion.fallbackUsed}
                  <span class="fallback-badge">Fallback used</span>
                {/if}
                <span 
                  class="severity-badge" 
                  style="background-color: {getSeverityColor(suggestion.severity || 'low')}"
                >
                  {suggestion.severity || 'info'}
                </span>
              </div>
              
              <div class="suggestion-content">
                {#if suggestion.segmentId}
                  <p class="segment-info">Segment: {suggestion.segmentId}</p>
                {/if}
                {#if suggestion.originalText}
                  <p class="original-text">"{suggestion.originalText}"</p>
                {/if}
                {#if suggestion.suggestedText}
                  <p class="suggested-text">→ "{suggestion.suggestedText}"</p>
                {/if}
                {#if suggestion.explanation || suggestion.text}
                  <p class="explanation">{suggestion.explanation || suggestion.text}</p>
                {/if}
                {#if suggestion.confidence}
                  <p class="confidence">Confidence: {(suggestion.confidence * 100).toFixed(0)}%</p>
                {/if}
                {#if suggestion.mappingConfidence !== undefined}
                  <p class="mapping-confidence">Position confidence: {(suggestion.mappingConfidence * 100).toFixed(0)}%</p>
                {/if}
              </div>

              <div class="suggestion-status">
                {#if suggestion.applied}
                  <Icon data={check} /> Applied
                {:else if suggestion.error}
                  <span class="error-text">Failed: {suggestion.error}</span>
                {:else if !suggestion.applied && !suggestion.error}
                  <button 
                    class="apply-btn"
                    onclick={() => applySuggestion(suggestion)}
                  >
                    Apply
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if currentAnalysis.positionsUsed}
        <div class="position-success">
          <Icon data={check} />
          <span>{$_('transcript.analysis.positionsUsedSuccess')}</span>
        </div>
      {/if}
    </div>
  {/if}

  <div class="pending-edits">
    {#if pendingEditsSummary.total > 0}
      <h5>{$_('transcript.analysis.pendingEdits')}</h5>
      <div class="pending-stats">
        <span>Pending: {pendingEditsSummary.pending}</span>
        <span>Applied: {pendingEditsSummary.applied}</span>
        <span>Rejected: {pendingEditsSummary.rejected}</span>
        <span>Stale: {pendingEditsSummary.stale}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .segment-control-position {
    padding: 1rem;
    background: var(--surface-1);
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }


  .analyze-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .analyze-btn.primary {
    background: var(--primary);
    color: white;
  }

  .analyze-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: var(--surface-2);
    border-radius: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-2);
    text-align: center;
  }

  .suggestions-list {
    margin-top: 1rem;
  }

  .suggestion-item {
    padding: 1rem;
    background: var(--surface-2);
    border-radius: 0.25rem;
    margin-bottom: 0.75rem;
    border-left: 3px solid var(--border);
    transition: all 0.2s;
  }

  .suggestion-item.applied {
    border-left-color: var(--success);
    opacity: 0.7;
  }

  .suggestion-item.failed {
    border-left-color: var(--error);
  }

  .suggestion-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .position-badge,
  .fallback-badge {
    padding: 0.125rem 0.5rem;
    background: var(--primary);
    color: white;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .fallback-badge {
    background: var(--warning);
  }

  .severity-badge {
    padding: 0.125rem 0.5rem;
    color: white;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .original-text {
    color: var(--text-2);
    font-style: italic;
  }

  .suggested-text {
    color: var(--success);
    font-weight: 500;
  }

  .confidence,
  .mapping-confidence {
    font-size: 0.875rem;
    color: var(--text-2);
  }

  .position-success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--success-bg);
    color: var(--success);
    border-radius: 0.25rem;
    margin-top: 1rem;
  }

  .error-message {
    padding: 0.75rem;
    background: var(--error-bg);
    color: var(--error);
    border-radius: 0.25rem;
    margin: 1rem 0;
  }

  .pending-edits {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .pending-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-2);
  }
</style>