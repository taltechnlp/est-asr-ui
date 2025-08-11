<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TranscriptSummary } from '@prisma/client';
  import type { TipTapEditorContent } from '../../../types';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import chevronLeft from 'svelte-awesome/icons/chevronLeft';
  import chevronRight from 'svelte-awesome/icons/chevronRight';
  import user from 'svelte-awesome/icons/user';
  import clockO from 'svelte-awesome/icons/clockO';
  import flask from 'svelte-awesome/icons/flask';
  import spinner from 'svelte-awesome/icons/spinner';
  import check from 'svelte-awesome/icons/check';
  import SegmentControlPosition from '../transcript-analysis/SegmentControlPosition.svelte';
  import { _ } from 'svelte-i18n';
  import { selectedSegmentStore } from '$lib/stores/selectedSegmentStore';
  import { analysisStateStore } from '$lib/stores/analysisStateStore';
  
  let {
    fileId = '',
    editorContent = null as TipTapEditorContent | null,
    audioFilePath = '',
    summary = null as TranscriptSummary | null,
    onSegmentAnalyzed = (result: any) => {},
    collapsed = false,
    onCollapsedChange = (value: boolean) => {}
  } = $props();

  let selectedSegment = $state<any>(null);
  let segmentText = $state('');
  let segmentAnalysisResult = $state<any>(null);
  
  // Subscribe to shared analysis state
  let analysisState = $state<any>(null);
  let isAnalyzing = $derived(
    analysisState?.isAnalyzing && 
    selectedSegment && 
    analysisState?.analyzingSegmentIndex === selectedSegment.index
  );
  
  // Subscribe to selected segment changes
  const unsubscribe = selectedSegmentStore.subscribe(segment => {
    selectedSegment = segment;
    if (segment) {
      // Extract segment text from the editor content
      extractSegmentText(segment);
      // Clear previous analysis when selecting new segment
      segmentAnalysisResult = null;
    }
  });
  
  function extractSegmentText(segment: any) {
    if (!editorContent || !editorContent.content) {
      segmentText = '';
      return;
    }
    
    // Find the segment in the editor content
    const node = editorContent.content.find((n: any) => 
      n.attrs && n.attrs.id === segment.id
    );
    
    if (node && node.content) {
      // Extract text from the node
      segmentText = node.content
        .filter((n: any) => n.type === 'text')
        .map((n: any) => n.text)
        .join('');
    } else {
      segmentText = segment.text || '';
    }
  }
  
  function toggleCollapsed() {
    const newValue = !collapsed;
    collapsed = newValue;
    onCollapsedChange(newValue);
  }
  
  function formatDuration(start: number, end: number): string {
    if (start < 0 || end < 0) return '';
    const duration = end - start;
    const seconds = Math.floor(duration);
    const ms = Math.floor((duration - seconds) * 1000);
    return `${seconds}.${ms.toString().padStart(3, '0')}s`;
  }
  
  function formatTimestamp(time: number): string {
    if (time < 0) return '';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  async function analyzeSelectedSegment() {
    if (!selectedSegment || !summary) return;
    
    // Check if already analyzing
    if (analysisState?.isAnalyzing) {
      return;
    }
    
    // Set shared state to analyzing
    analysisStateStore.startAnalysis(fileId, selectedSegment.index);
    
    try {
      // Call the position-based analysis for this segment
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
          segmentId: selectedSegment.id,
          usePositions: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      segmentAnalysisResult = await response.json();
      
      // Mark as completed in shared state
      analysisStateStore.completeAnalysis(fileId, selectedSegment.index);
      onSegmentAnalyzed(segmentAnalysisResult);
    } catch (err) {
      console.error('Segment analysis error:', err);
      analysisStateStore.setError(fileId, err instanceof Error ? err.message : 'Analysis failed');
    }
  }
  
  onMount(() => {
    // Subscribe to analysis state
    const unsubscribeAnalysis = analysisStateStore.subscribe(fileId, (state) => {
      analysisState = state;
    });
    
    return () => {
      unsubscribeAnalysis();
    };
  });
  
  onDestroy(() => {
    unsubscribe();
  });
</script>

<aside class="transcript-sidebar {collapsed ? 'collapsed' : ''}">
  <div class="sidebar-header">
    <button
      class="collapse-btn"
      onclick={toggleCollapsed}
      title={collapsed ? $_('transcript.sidebar.expand') : $_('transcript.sidebar.collapse')}
    >
      <Icon data={collapsed ? chevronRight : chevronLeft} />
    </button>
    
    {#if !collapsed}
      <h3>{$_('transcript.sidebar.title')}</h3>
    {/if}
  </div>
  
  {#if !collapsed}
    <div class="sidebar-content">
      {#if selectedSegment}
        <!-- Selected Segment Info -->
        <div class="segment-info">
          <div class="segment-header">
            <div class="segment-speaker">
              <Icon data={user} scale={0.8} />
              <span>{selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker'}</span>
            </div>
            {#if selectedSegment.start >= 0 && selectedSegment.end >= 0}
              <div class="segment-timing">
                <Icon data={clockO} scale={0.8} />
                <span>{formatTimestamp(selectedSegment.start)} - {formatTimestamp(selectedSegment.end)}</span>
                <span class="duration">({formatDuration(selectedSegment.start, selectedSegment.end)})</span>
              </div>
            {/if}
          </div>
          
          <!-- Segment Text Preview -->
          <div class="segment-preview">
            <h4>{$_('transcript.sidebar.segmentText')}</h4>
            <div class="segment-text">
              {segmentText.slice(0, 200)}{segmentText.length > 200 ? '...' : ''}
            </div>
          </div>
          
          <!-- Analyze Button -->
          <button
            class="analyze-segment-btn"
            onclick={analyzeSelectedSegment}
            disabled={isAnalyzing || !summary}
          >
            {#if isAnalyzing}
              <Icon data={spinner} spin />
              {$_('transcript.analysis.analyzing')}
            {:else if segmentAnalysisResult}
              <Icon data={check} />
              {$_('transcript.analysis.analyzed')}
            {:else}
              <Icon data={flask} />
              {$_('transcript.analysis.analyzeSegment')}
            {/if}
          </button>
          
          <!-- Analysis Results -->
          {#if segmentAnalysisResult}
            <div class="analysis-results">
              <h4>{$_('transcript.analysis.results')}</h4>
              <SegmentControlPosition
                {fileId}
                {editorContent}
                {audioFilePath}
                {summary}
                onSegmentAnalyzed={onSegmentAnalyzed}
              />
            </div>
          {/if}
        </div>
      {:else}
        <!-- No Segment Selected -->
        <div class="no-segment">
          <p>{$_('transcript.sidebar.noSegmentSelected')}</p>
          <p class="hint">{$_('transcript.sidebar.clickToSelect')}</p>
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .transcript-sidebar {
    background: white;
    border-left: 1px solid #e5e7eb;
    height: 100%;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    width: 400px;
    position: relative;
  }
  
  .transcript-sidebar.collapsed {
    width: 48px;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #f9fafb;
  }
  
  .collapse-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: #6b7280;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .collapse-btn:hover {
    color: #374151;
  }
  
  .sidebar-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .segment-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .segment-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .segment-speaker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #374151;
  }
  
  .segment-timing {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .duration {
    font-size: 0.75rem;
    color: #9ca3af;
  }
  
  .segment-preview {
    background: #f9fafb;
    border-radius: 0.5rem;
    padding: 1rem;
  }
  
  .segment-preview h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .segment-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: #374151;
    word-wrap: break-word;
  }
  
  .analyze-segment-btn {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .analyze-segment-btn:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }
  
  .analyze-segment-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .analysis-results {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .analysis-results h4 {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .no-segment {
    text-align: center;
    padding: 2rem 1rem;
    color: #6b7280;
  }
  
  .no-segment p {
    margin: 0 0 0.5rem 0;
  }
  
  .hint {
    font-size: 0.875rem;
    font-style: italic;
    color: #9ca3af;
  }
  
  /* Mobile responsiveness */
  @media (max-width: 1024px) {
    .transcript-sidebar {
      position: fixed;
      right: 0;
      top: 0;
      height: 100vh;
      z-index: 1000;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .transcript-sidebar:not(.collapsed) {
      width: 100%;
      max-width: 400px;
    }
  }
</style>