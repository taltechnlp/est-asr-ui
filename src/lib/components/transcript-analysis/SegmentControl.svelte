<script lang="ts">
  import { onMount } from 'svelte';
  import type { AnalysisSegment, TranscriptSummary } from '@prisma/client';
  import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
  import type { TipTapEditorContent } from '../../../types';
  import { extractSpeakerSegments } from '$lib/utils/extractWordsFromEditor';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import play from 'svelte-awesome/icons/play';
  import chevronLeft from 'svelte-awesome/icons/chevronLeft';
  import chevronRight from 'svelte-awesome/icons/chevronRight';
  import spinner from 'svelte-awesome/icons/spinner';
  import check from 'svelte-awesome/icons/check';
  import { _ } from 'svelte-i18n';

  let {
    fileId = '',
    editorContent = null as TipTapEditorContent | null,
    audioFilePath = '',
    summary = null as TranscriptSummary | null,
    onSegmentAnalyzed = (result: any) => {},
  } = $props();

  let segments = $state<SegmentWithTiming[]>([]);
  let currentSegmentIndex = $state(0);
  let currentSegment = $state<SegmentWithTiming | null>(null);
  let analyzedSegments = $state<Map<number, AnalysisSegment>>(new Map());
  let isAnalyzing = $state(false);
  let error = $state<string | null>(null);
  let showResults = $state(false);
  let currentAnalysis = $state<AnalysisSegment | null>(null);
  let isInitialized = $state(false);

  $effect(() => {
    if (editorContent && !isInitialized) {
      const newSegments = extractSpeakerSegments(editorContent);
      segments = newSegments;
      if (newSegments.length > 0) {
        currentSegment = newSegments[0];
        currentSegmentIndex = 0;
      }
      isInitialized = true;
    }
  });

  onMount(() => {
    loadAnalyzedSegments();
  });

  async function loadAnalyzedSegments() {
    if (!fileId) return;

    try {
      const response = await fetch(`/api/transcript-analysis/segments/${fileId}/`);
      if (response.ok) {
        const data = await response.json();
        const segmentMap = new Map<number, AnalysisSegment>();
        data.forEach((seg: AnalysisSegment) => {
          segmentMap.set(seg.segmentIndex, seg);
        });
        analyzedSegments = segmentMap;
      }
    } catch (err) {
      console.error('Failed to load analyzed segments:', err);
    }
  }

  async function analyzeCurrentSegment() {
    if (!currentSegment || !summary || isAnalyzing) return;

    isAnalyzing = true;
    error = null;
    showResults = false;

    try {
      const response = await fetch('/api/transcript-analysis/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          segment: currentSegment,
          summaryId: summary.id,
          audioFilePath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result = await response.json();
      
      // Update the map with the new analysis
      analyzedSegments.set(currentSegmentIndex, result.analysisSegment);
      analyzedSegments = new Map(analyzedSegments); // Trigger reactivity
      
      currentAnalysis = result.analysisSegment;
      showResults = true;
      
      onSegmentAnalyzed(result);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to analyze segment';
      console.error('Segment analysis error:', err);
    } finally {
      isAnalyzing = false;
    }
  }

  function goToPreviousSegment() {
    if (currentSegmentIndex > 0 && segments.length > 0) {
      const newIndex = currentSegmentIndex - 1;
      currentSegmentIndex = newIndex;
      currentSegment = segments[newIndex];
      showResults = false;
      
      const analysis = analyzedSegments.get(newIndex);
      if (analysis) {
        currentAnalysis = analysis;
        showResults = true;
      } else {
        currentAnalysis = null;
      }
    }
  }

  function goToNextSegment() {
    if (currentSegmentIndex < segments.length - 1 && segments.length > 0) {
      const newIndex = currentSegmentIndex + 1;
      currentSegmentIndex = newIndex;
      currentSegment = segments[newIndex];
      showResults = false;
      
      const analysis = analyzedSegments.get(newIndex);
      if (analysis) {
        currentAnalysis = analysis;
        showResults = true;
      } else {
        currentAnalysis = null;
      }
    }
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

<div class="segment-control">
  <div class="control-header">
    <h3>{$_('transcript.analysis.segmentControl')}</h3>
    <div class="segment-info">
      {#if segments.length > 0}
        <span>{$_('transcript.analysis.segment')} {currentSegmentIndex + 1} / {segments.length}</span>
      {/if}
    </div>
  </div>

  {#if currentSegment}
    <div class="segment-content">
      <div class="segment-metadata">
        <div class="metadata-item">
          <span class="speaker-tag">{currentSegment.speakerName || currentSegment.speakerTag}</span>
        </div>
        <div class="metadata-item">
          <Icon data={play} />
          <span>{formatTime(currentSegment.startTime)} - {formatTime(currentSegment.endTime)}</span>
        </div>
        <div class="metadata-item">
          <span>{$_('transcript.metadata.duration')}: {formatTime(currentSegment.endTime - currentSegment.startTime)}</span>
        </div>
        <div class="metadata-item">
          <span>{currentSegment.words.length} {$_('transcript.analysis.words')}</span>
        </div>
      </div>

      <div class="segment-text">
        <p>{currentSegment.text}</p>
      </div>

      <div class="control-actions">
        <button
          class="nav-btn"
          onclick={goToPreviousSegment}
          disabled={currentSegmentIndex === 0}
        >
          <Icon data={chevronLeft} />
          {$_('common.previous')}
        </button>

        <button
          class="analyze-btn"
          onclick={analyzeCurrentSegment}
          disabled={isAnalyzing || !summary}
        >
          {#if isAnalyzing}
            <Icon data={spinner} spin />
            {$_('transcript.analysis.analyzing')}
          {:else if analyzedSegments.has(currentSegmentIndex)}
            <Icon data={check} />
            {$_('transcript.analysis.reanalyze')}
          {:else}
            {$_('transcript.analysis.analyzeSegment')}
          {/if}
        </button>

        <button
          class="nav-btn"
          onclick={goToNextSegment}
          disabled={currentSegmentIndex === segments.length - 1}
        >
          {$_('common.next')}
          <Icon data={chevronRight} />
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
          
          <div class="analysis-section">
            <h5>{$_('transcript.analysis.analysis')}</h5>
            <p>{currentAnalysis.analysis}</p>
          </div>

          {#if currentAnalysis.suggestions && Array.isArray(currentAnalysis.suggestions)}
            <div class="suggestions-section">
              <h5>{$_('transcript.analysis.suggestions')} ({currentAnalysis.suggestions.length})</h5>
              {#each currentAnalysis.suggestions as suggestion, index}
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
                </div>
              {/each}
            </div>
          {/if}

          {#if currentAnalysis.nBestResults?.alternatives}
            <div class="nbest-section">
              <h5>{$_('transcript.analysis.alternatives')}</h5>
              {#each currentAnalysis.nBestResults.alternatives as alt, index}
                <div class="alternative-item">
                  <span class="alt-index">{index + 1}.</span>
                  <span class="alt-text">{alt.text}</span>
                  {#if alt.confidence}
                    <span class="alt-confidence">{(alt.confidence * 100).toFixed(1)}%</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="no-segments">
      <p>{$_('transcript.analysis.noSegments')}</p>
    </div>
  {/if}

  <div class="progress-bar">
    <div 
      class="progress-fill" 
      style="width: {segments.length > 0 ? ((currentSegmentIndex + 1) / segments.length * 100) : 0}%"
    ></div>
  </div>
</div>

<style>
  .segment-control {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .control-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }

  .segment-info {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .segment-content {
    margin-bottom: 1rem;
  }

  .segment-metadata {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .metadata-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .speaker-tag {
    padding: 0.125rem 0.5rem;
    background: #e0e7ff;
    color: #4338ca;
    border-radius: 4px;
    font-weight: 500;
  }

  .segment-text {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .segment-text p {
    margin: 0;
    line-height: 1.6;
    color: #374151;
  }

  .control-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .nav-btn,
  .analyze-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .analyze-btn {
    background: var(--primary-color, #3b82f6);
    color: white;
    border-color: var(--primary-color, #3b82f6);
  }

  .nav-btn:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .analyze-btn:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }

  .nav-btn:disabled,
  .analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    background: #fee;
    color: #c53030;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .error-message p {
    margin: 0;
  }

  .analysis-results {
    background: #f9fafb;
    border-radius: 6px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .analysis-results h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .analysis-section,
  .suggestions-section,
  .nbest-section {
    margin-bottom: 1rem;
  }

  .analysis-section h5,
  .suggestions-section h5,
  .nbest-section h5 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #4b5563;
  }

  .analysis-section p {
    margin: 0;
    line-height: 1.6;
    color: #374151;
  }

  .suggestion-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
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
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #374151;
  }

  .alternative-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    margin-bottom: 0.25rem;
  }

  .alt-index {
    font-weight: 600;
    color: #6b7280;
  }

  .alt-text {
    flex: 1;
    color: #374151;
    font-size: 0.875rem;
  }

  .alt-confidence {
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 600;
  }

  .no-segments {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .progress-bar {
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 1rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-color, #3b82f6);
    transition: width 0.3s ease;
  }
</style>