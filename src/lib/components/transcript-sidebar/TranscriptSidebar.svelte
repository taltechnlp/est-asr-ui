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
  import refresh from 'svelte-awesome/icons/refresh';
  import exclamationTriangle from 'svelte-awesome/icons/exclamationTriangle';
  import wrench from 'svelte-awesome/icons/wrench';
  import SegmentControlPosition from '../transcript-analysis/SegmentControlPosition.svelte';
  import { _, locale } from 'svelte-i18n';
  import { selectedSegmentStore } from '$lib/stores/selectedSegmentStore';
  import { analysisStateStore } from '$lib/stores/analysisStateStore';
  import { normalizeLanguageCode } from '$lib/utils/language';
  import { editor as editorStore } from '$lib/stores.svelte';
  import { getReconciliationService } from '$lib/services/editReconciliation';
  import { getPositionMapper } from '$lib/services/positionMapper';
  
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
  let isReanalyzing = $state(false);
  let applyingStates = $state<Record<number, boolean>>({});
  let documentVersionAtAnalysis = $state<any>(null);
  let reconciliationService = $state<any>(null);
  
  // Subscribe to shared analysis state
  let analysisState = $state<any>(null);
  let isAnalyzing = $derived(
    analysisState?.isAnalyzing && 
    selectedSegment && 
    analysisState?.analyzingSegmentIndex === selectedSegment.index
  );
  
  // Subscribe to selected segment changes
  const unsubscribe = selectedSegmentStore.subscribe(async segment => {
    selectedSegment = segment;
    if (segment) {
      // Extract segment text from the editor content
      extractSegmentText(segment);
      
      // Clear previous analysis when selecting new segment
      segmentAnalysisResult = null;
      
      // Check if there's an existing analysis for this segment
      try {
        const response = await fetch(`/api/transcript-analysis/segments/${fileId}/`);
        if (response.ok) {
          const segments = await response.json();
          const existingAnalysis = segments.find((s: any) => 
            s.segmentIndex === segment.index
          );
          
          if (existingAnalysis) {
            // Parse suggestions if they're a string
            if (typeof existingAnalysis.suggestions === 'string') {
              try {
                existingAnalysis.suggestions = JSON.parse(existingAnalysis.suggestions);
              } catch (e) {
                console.error('Failed to parse existing suggestions:', e);
                existingAnalysis.suggestions = [];
              }
            }
            
            segmentAnalysisResult = existingAnalysis;
            console.log('Loaded existing analysis:', existingAnalysis);
            
            // Auto-apply suggestions for existing analysis if not already applied
            await applyAutoSuggestions(existingAnalysis);
          }
        }
      } catch (error) {
        console.error('Failed to check for existing analysis:', error);
      }
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
    
    // Store document version at analysis time
    const editor = $editorStore;
    if (editor) {
      const mapper = getPositionMapper(editor);
      documentVersionAtAnalysis = mapper.getVersion();
      console.log('📸 Captured document version:', documentVersionAtAnalysis);
      
      // Initialize reconciliation service if needed
      if (!reconciliationService) {
        reconciliationService = getReconciliationService(editor);
      }
    }
    
    // Set shared state to analyzing
    analysisStateStore.startAnalysis(fileId, selectedSegment.index);
    
    try {
      // Create segment object with required fields
      const segment = {
        index: selectedSegment.index || 0,
        startTime: typeof selectedSegment.start === 'number' ? selectedSegment.start : 0,
        endTime: typeof selectedSegment.end === 'number' ? selectedSegment.end : 0,
        startWord: 0,  // Required field
        endWord: 0,    // Required field
        text: segmentText || selectedSegment.text || '',
        speakerTag: selectedSegment.speakerTag || selectedSegment.speakerName || 'Speaker',
        speakerName: selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker',
        words: []
      };
      
      console.log('Sending segment to API:', segment);
      
      // Call the same endpoint as the popup component
      const currentLocale = normalizeLanguageCode($locale);
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
          uiLanguage: currentLocale,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      console.log('Analysis result from API:', result);
      
      // Handle the response structure
      if (result.analysisSegment) {
        // The analysisSegment from database has suggestions as a JSON string
        const dbRecord = result.analysisSegment;
        
        // Parse suggestions if they're a string
        if (typeof dbRecord.suggestions === 'string') {
          try {
            dbRecord.suggestions = JSON.parse(dbRecord.suggestions);
          } catch (e) {
            console.error('Failed to parse suggestions:', e);
            dbRecord.suggestions = [];
          }
        }
        
        segmentAnalysisResult = dbRecord;
      } else if (result.suggestions) {
        // Direct suggestions in result - ensure they're parsed if needed
        if (typeof result.suggestions === 'string') {
          try {
            result.suggestions = JSON.parse(result.suggestions);
          } catch (e) {
            console.error('Failed to parse suggestions:', e);
            result.suggestions = [];
          }
        }
        segmentAnalysisResult = result;
      } else {
        console.warn('Unexpected response structure:', result);
        segmentAnalysisResult = result;
      }
      
      console.log('segmentAnalysisResult set to:', segmentAnalysisResult);
      console.log('Suggestions:', segmentAnalysisResult?.suggestions);
      
      // Reset applying states when we get new results
      applyingStates = {};
      
      // Mark as completed in shared state
      analysisStateStore.completeAnalysis(fileId, selectedSegment.index);
      onSegmentAnalyzed(segmentAnalysisResult);
      
      // Automatically apply suggestions marked with shouldAutoApply
      await applyAutoSuggestions(segmentAnalysisResult);
    } catch (err) {
      console.error('Segment analysis error:', err);
      analysisStateStore.setError(fileId, err instanceof Error ? err.message : 'Analysis failed');
    }
  }
  
  async function applyAutoSuggestions(analysisResult: any) {
    if (!analysisResult?.suggestions || !Array.isArray(analysisResult.suggestions)) {
      return;
    }
    
    const autoApplySuggestions = analysisResult.suggestions.filter(
      (s: any) => s.shouldAutoApply && !s.applied && s.originalText && s.suggestedText
    );
    
    if (autoApplySuggestions.length === 0) {
      console.log('No suggestions marked for auto-apply');
      return;
    }
    
    console.group(`🤖 Auto-applying ${autoApplySuggestions.length} suggestions as diff nodes`);
    
    for (const suggestion of autoApplySuggestions) {
      try {
        console.log(`Creating diff: "${suggestion.originalText}" → "${suggestion.suggestedText}"`);
        
        // Dispatch event to create diff node in the editor
        const event = new CustomEvent('applyTranscriptSuggestionAsDiff', {
          detail: {
            suggestion,
            segmentId: selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker',
            callback: (result: any) => {
              if (result.success) {
                console.log(`✅ Diff created: ${result.diffId}`);
                // Update the suggestion to mark it as having a diff created
                suggestion.diffCreated = true;
                suggestion.diffId = result.diffId;
              } else {
                console.error(`❌ Failed to create diff: ${result.error}`);
              }
            }
          }
        });
        
        window.dispatchEvent(event);
        
        // Small delay between creating diffs to avoid overwhelming the editor
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error creating diff for suggestion:', error);
      }
    }
    
    console.groupEnd();
  }
  
  async function reanalyzeSegment() {
    if (!selectedSegment || !summary || isReanalyzing) return;
    
    isReanalyzing = true;
    
    try {
      // First delete the existing analysis from database
      const deleteResponse = await fetch(`/api/transcript-analysis/segments/${fileId}/${selectedSegment.index}`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        console.warn('Failed to delete existing analysis, continuing with re-analysis');
      }
      
      // Clear the current results
      segmentAnalysisResult = null;
      applyingStates = {};
      
      // Perform fresh analysis
      await analyzeSelectedSegment();
    } finally {
      isReanalyzing = false;
    }
  }
  
  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  }
  
  async function applySuggestion(suggestion: any, index: number) {
    if (!suggestion?.originalText || !suggestion?.suggestedText || applyingStates[index]) {
      return;
    }
    
    // Check if a diff has already been created for this suggestion
    if (suggestion.diffCreated) {
      console.log('Diff already created for this suggestion:', suggestion.diffId);
      return;
    }
    
    applyingStates[index] = true;
    
    try {
      // If we have position info and reconciliation service, reconcile first
      let reconciledSuggestion = { ...suggestion };
      
      if (suggestion.from !== undefined && suggestion.to !== undefined && reconciliationService) {
        // Add to reconciliation service for tracking
        const editId = reconciliationService.addPendingEdit({
          id: `suggestion_${index}_${Date.now()}`,
          type: 'suggestion',
          from: suggestion.from,
          to: suggestion.to,
          originalText: suggestion.originalText,
          suggestedText: suggestion.suggestedText,
          confidence: suggestion.confidence || 0.5,
          version: documentVersionAtAnalysis || { id: 'unknown', timestamp: Date.now(), transactionCount: 0 }
        });
        
        // Reconcile to current document state
        const reconcileResult = await reconciliationService.reconcileEdit(editId);
        
        if (reconcileResult.success && reconcileResult.newFrom !== undefined && reconcileResult.newTo !== undefined) {
          console.log(`📍 Reconciled positions: [${suggestion.from}, ${suggestion.to}] → [${reconcileResult.newFrom}, ${reconcileResult.newTo}]`);
          reconciledSuggestion.from = reconcileResult.newFrom;
          reconciledSuggestion.to = reconcileResult.newTo;
        } else if (!reconcileResult.success) {
          console.warn('Position reconciliation failed, falling back to text search');
        }
      }
      
      // Dispatch event to create diff node
      const event = new CustomEvent('applyTranscriptSuggestionAsDiff', {
        detail: {
          suggestion: reconciledSuggestion,
          segmentId: selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker',
          callback: (result: any) => {
            if (result.success) {
              // Mark as having diff created
              if (segmentAnalysisResult?.suggestions) {
                segmentAnalysisResult.suggestions[index] = {
                  ...suggestion,
                  diffCreated: true,
                  diffId: result.diffId,
                  appliedAt: result.appliedAt
                };
              }
              console.log(`✅ Manual diff created: ${result.diffId}`);
            } else {
              console.error('Failed to create diff:', result.error);
            }
            applyingStates[index] = false;
          }
        }
      });
      
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to create diff for suggestion:', error);
      applyingStates[index] = false;
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
    
    // Clean up reconciliation service
    if (reconciliationService) {
      reconciliationService.stopPeriodicReconciliation();
    }
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
          
          <!-- Analysis in Progress Notice -->
          {#if isAnalyzing}
            <div class="analysis-notice info">
              <Icon data={spinner} spin scale={0.9} />
              <span>Analyzing segment... You can continue editing</span>
            </div>
          {/if}
          
          <!-- Analysis Results -->
          {#if segmentAnalysisResult}
            <div class="analysis-results">
              <div class="results-header">
                <h4>{$_('transcript.analysis.results')}</h4>
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
              </div>
              
              <!-- Suggestions Section -->
              {#if segmentAnalysisResult?.suggestions && Array.isArray(segmentAnalysisResult.suggestions) && segmentAnalysisResult.suggestions.length > 0}
                <div class="suggestions-section">
                  <h5>{$_('transcript.analysis.suggestions')} ({segmentAnalysisResult.suggestions.length})</h5>
                  {#each (segmentAnalysisResult.suggestions as any[]) as suggestion, index}
                    <div class="suggestion-item">
                      <div class="suggestion-header">
                        <span class="suggestion-type">{suggestion?.type ? $_(`transcript.suggestion.${suggestion.type}`) : $_('transcript.suggestion.unknown')}</span>
                        <div class="suggestion-header-right">
                          <span 
                            class="suggestion-severity" 
                            style="color: {getSeverityColor(suggestion?.severity || 'low')}"
                          >
                            {$_(`transcript.severity.${suggestion?.severity || 'low'}`)}
                          </span>
                          {#if suggestion?.diffCreated}
                            <span class="diff-badge">{$_('transcript.suggestion.diffCreated') || 'Diff Created'}</span>
                          {:else if suggestion?.applied}
                            <span class="applied-badge">{$_('transcript.suggestion.applied')}</span>
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
                              <span>{applyingStates[index] ? $_('transcript.suggestion.applying') : $_('transcript.suggestion.apply')}</span>
                            </button>
                          {/if}
                        </div>
                      </div>
                      <p class="suggestion-text">{suggestion?.text || suggestion?.explanation || $_('transcript.suggestion.noDescription')}</p>
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
              
              <!-- Original SegmentControlPosition component (if needed) -->
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
  
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .results-header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .reanalyze-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
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
  
  .suggestions-section {
    margin-bottom: 1rem;
  }
  
  .suggestions-section h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }
  
  .suggestion-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .suggestion-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .suggestion-type {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .suggestion-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .suggestion-severity {
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .applied-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: #d1fae5;
    color: #065f46;
    border-radius: 0.25rem;
    font-weight: 500;
  }
  
  .diff-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: #fef3c7;
    color: #92400e;
    border-radius: 0.25rem;
    font-weight: 500;
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
    background: #3b82f6;
    color: white;
  }
  
  .apply-suggestion-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .suggestion-text {
    font-size: 0.8125rem;
    color: #4b5563;
    line-height: 1.5;
    margin: 0 0 0.5rem 0;
  }
  
  .suggestion-changes {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .original,
  .suggested {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .original strong,
  .suggested strong {
    font-weight: 600;
    color: #374151;
    min-width: 70px;
  }
  
  .original {
    color: #dc2626;
  }
  
  .suggested {
    color: #059669;
  }
  
  .no-suggestions {
    text-align: center;
    padding: 1.5rem 1rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .no-suggestions p {
    margin: 0;
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
  
  .analysis-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 0.375rem;
    color: #92400e;
    font-size: 0.875rem;
    font-weight: 500;
    animation: pulse 2s infinite;
  }
  
  .analysis-notice.info {
    background: #dbeafe;
    border-color: #60a5fa;
    color: #1e40af;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
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