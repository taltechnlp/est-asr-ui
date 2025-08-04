<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TranscriptAnalysisRequest, TranscriptAnalysisResult, ImprovementSuggestion } from '$lib/agents/schemas/transcript';
  import type { TipTapEditorContent } from '../../../types';
  import type { TranscriptSummary } from '@prisma/client';
  import SuggestionCard from './SuggestionCard.svelte';
  import AnalysisPanel from './AnalysisPanel.svelte';
  import SegmentControl from '../transcript-analysis/SegmentControl.svelte';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import comment from 'svelte-awesome/icons/comment';
  import times from 'svelte-awesome/icons/times';
  import spinner from 'svelte-awesome/icons/spinner';
  import { _ } from 'svelte-i18n';
  import { applySuggestion } from '$lib/handlers/applySuggestion';
  import ReplacementFeedback from './ReplacementFeedback.svelte';

  let { 
    fileId = '',
    transcript = '',
    editorContent = null as TipTapEditorContent | null,
    audioFilePath = '',
    segments = [],
    words = [],
    speakers = [],
    language = 'et',
    summary = null as TranscriptSummary | null,
    onSummaryGenerated = (summary: TranscriptSummary) => {},
    onSuggestionApply = (suggestion: ImprovementSuggestion) => {}
  } = $props();

  let isOpen = $state(false);
  let isAnalyzing = $state(false);
  let analysisResult = $state<TranscriptAnalysisResult | null>(null);
  let error = $state<string | null>(null);
  let selectedModel = $state('anthropic/claude-3.5-sonnet');
  let analysisType = $state<'full' | 'grammar' | 'punctuation' | 'speaker_diarization' | 'confidence' | 'context'>('full');
  let feedbackMessage = $state<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  let activeTab = $state<'analysis' | 'legacy'>('analysis');

  const availableModels = [
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku (Faster)' },
    { value: 'openai/gpt-4o', label: 'GPT-4o' },
    { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  ];

  const analysisTypes = [
    { value: 'full', label: $_('transcript.analysis.full') },
    { value: 'grammar', label: $_('transcript.analysis.grammar') },
    { value: 'punctuation', label: $_('transcript.analysis.punctuation') },
    { value: 'speaker_diarization', label: $_('transcript.analysis.speakers') },
    { value: 'confidence', label: $_('transcript.analysis.confidence') },
    { value: 'context', label: $_('transcript.analysis.context') },
  ];

  async function analyzeTranscript() {
    if (!transcript || isAnalyzing) return;

    isAnalyzing = true;
    error = null;
    analysisResult = null;

    try {
      const request: TranscriptAnalysisRequest & { model: string; stream: boolean } = {
        transcript,
        segments: segments.map(s => ({
          id: s.id,
          text: s.text,
          speaker: s.speaker,
          start: s.start,
          end: s.end,
          confidence: s.confidence,
        })),
        words,
        speakers,
        language,
        analysisType,
        model: selectedModel,
        stream: false, // For now, use non-streaming
      };

      const response = await fetch('/api/transcript-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      analysisResult = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Transcript analysis error:', err);
    } finally {
      isAnalyzing = false;
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
  }

  function handleSegmentAnalyzed(result: any) {
    // Handle segment analysis results if needed
    console.log('Segment analyzed:', result);
  }

  async function handleApplySuggestion(suggestion: ImprovementSuggestion) {
    feedbackMessage = null;
    
    try {
      const result = await applySuggestion(suggestion);
      
      if (result.success) {
        feedbackMessage = {
          type: 'success',
          message: result.message
        };
        
        // Also call the parent handler if provided
        onSuggestionApply(suggestion);
        
        // Clear feedback after 3 seconds
        setTimeout(() => {
          feedbackMessage = null;
        }, 3000);
      } else {
        feedbackMessage = {
          type: result.requiresUserInput ? 'warning' : 'error',
          message: result.message
        };
      }
    } catch (err) {
      feedbackMessage = {
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to apply suggestion'
      };
    }
  }

  // Keyboard shortcut
  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      toggleChat();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="transcript-chat-container">
  <!-- Toggle Button -->
  <button
    class="chat-toggle-btn"
    onclick={toggleChat}
    title={$_('transcript.chat.toggle')}
    aria-label={$_('transcript.chat.toggle')}
  >
    <Icon data={comment} />
  </button>

  <!-- Chat Panel -->
  {#if isOpen}
    <div class="chat-panel">
      <div class="chat-header">
        <h3>{$_('transcript.chat.title')}</h3>
        <button
          class="close-btn"
          onclick={toggleChat}
          aria-label={$_('common.close')}
        >
          <Icon data={times} />
        </button>
      </div>

      <div class="chat-tabs">
        <button
          class="tab-btn {activeTab === 'analysis' ? 'active' : ''}"
          onclick={() => activeTab = 'analysis'}
        >
          {$_('transcript.tabs.analysis')}
        </button>
        <button
          class="tab-btn {activeTab === 'legacy' ? 'active' : ''}"
          onclick={() => activeTab = 'legacy'}
        >
          {$_('transcript.tabs.legacy')}
        </button>
      </div>

      {#if activeTab === 'legacy'}
        <div class="chat-controls">
          <select
            bind:value={selectedModel}
            disabled={isAnalyzing}
            class="model-select"
          >
            {#each availableModels as model}
              <option value={model.value}>{model.label}</option>
            {/each}
          </select>

          <select
            bind:value={analysisType}
            disabled={isAnalyzing}
            class="analysis-type-select"
          >
            {#each analysisTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>

          <button
            class="analyze-btn"
            onclick={analyzeTranscript}
            disabled={isAnalyzing || !transcript}
          >
            {#if isAnalyzing}
              <Icon data={spinner} spin />
              {$_('transcript.chat.analyzing')}
            {:else}
              {$_('transcript.chat.analyze')}
            {/if}
          </button>
        </div>
      {/if}

      <div class="chat-content">
        {#if feedbackMessage}
          <ReplacementFeedback
            type={feedbackMessage.type}
            message={feedbackMessage.message}
            onClose={() => feedbackMessage = null}
          />
        {/if}

        {#if error}
          <div class="error-message">
            <p>{$_('common.error')}: {error}</p>
          </div>
        {/if}

        {#if activeTab === 'analysis'}
          <SegmentControl
            {fileId}
            {editorContent}
            {audioFilePath}
            {summary}
            onSegmentAnalyzed={handleSegmentAnalyzed}
          />
        {:else if activeTab === 'legacy'}
          {#if analysisResult}
            <AnalysisPanel {analysisResult} />
            
            <div class="suggestions-list">
              <h4>{$_('transcript.chat.suggestions')} ({analysisResult.suggestions.length})</h4>
              {#each analysisResult.suggestions as suggestion}
                <SuggestionCard
                  {suggestion}
                  onApply={() => handleApplySuggestion(suggestion)}
                />
              {/each}
            </div>
          {:else if !isAnalyzing && !error}
            <div class="empty-state">
              <p>{$_('transcript.chat.emptyState')}</p>
              <p class="hint">{$_('transcript.chat.hint')}</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .transcript-chat-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 1000;
  }

  .chat-toggle-btn {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .chat-toggle-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .chat-panel {
    position: absolute;
    bottom: 4.5rem;
    right: 0;
    width: 500px;
    max-width: 90vw;
    height: 600px;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
    z-index: 1001;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .chat-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
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

  .chat-tabs {
    display: flex;
    gap: 0;
    padding: 0 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: #374151;
    background: #f9fafb;
  }

  .tab-btn.active {
    color: var(--primary-color, #3b82f6);
    border-bottom-color: var(--primary-color, #3b82f6);
  }

  .chat-controls {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .model-select,
  .analysis-type-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    font-size: 0.875rem;
  }

  .analyze-btn {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .analyze-btn:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }

  .analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    min-height: 0;
  }

  .error-message {
    background: #fee;
    color: #c53030;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .suggestions-list {
    margin-top: 1rem;
  }

  .suggestions-list h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
    opacity: 0.8;
  }

  @media (max-width: 640px) {
    .chat-panel {
      width: calc(100vw - 2rem);
      right: 1rem;
      left: 1rem;
      bottom: 3.5rem;
      border-radius: 12px;
      max-width: none;
    }
    
    .tab-btn {
      font-size: 0.75rem;
      padding: 0.5rem 0.75rem;
    }
  }
</style>