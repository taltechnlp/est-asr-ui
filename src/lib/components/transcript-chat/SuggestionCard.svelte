<script lang="ts">
  import type { ImprovementSuggestion } from '$lib/agents/schemas/transcript';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import check from 'svelte-awesome/icons/check';
  import times from 'svelte-awesome/icons/times';
  import exclamationTriangle from 'svelte-awesome/icons/exclamationTriangle';
  import info from 'svelte-awesome/icons/infoCircle';
  import { _ } from 'svelte-i18n';

  let { 
    suggestion,
    onApply = () => {},
    onReject = () => {}
  }: {
    suggestion: ImprovementSuggestion;
    onApply?: () => void;
    onReject?: () => void;
  } = $props();

  let isApplied = $state(false);
  let isRejected = $state(false);

  const severityIcons = {
    low: info,
    medium: exclamationTriangle,
    high: exclamationTriangle,
  };

  const severityColors = {
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#ef4444',
  };

  const typeLabels: Record<string, string> = {
    grammar: $_('transcript.suggestion.grammar'),
    punctuation: $_('transcript.suggestion.punctuation'),
    speaker_change: $_('transcript.suggestion.speaker'),
    low_confidence: $_('transcript.suggestion.confidence'),
    context_error: $_('transcript.suggestion.context'),
    formatting: $_('transcript.suggestion.formatting'),
  };

  function handleApply() {
    if (!isApplied && !isRejected) {
      isApplied = true;
      onApply();
    }
  }

  function handleReject() {
    if (!isApplied && !isRejected) {
      isRejected = true;
      onReject();
    }
  }
</script>

<div class="suggestion-card" class:applied={isApplied} class:rejected={isRejected}>
  <div class="suggestion-header">
    <div class="suggestion-type">
      <Icon 
        data={severityIcons[suggestion.severity]} 
        style="color: {severityColors[suggestion.severity]}"
      />
      <span class="type-label">{typeLabels[suggestion.type] || suggestion.type}</span>
      <span class="confidence">({Math.round(suggestion.confidence * 100)}%)</span>
    </div>
    <div class="suggestion-actions">
      <button
        class="action-btn apply"
        onclick={handleApply}
        disabled={isApplied || isRejected}
        title={$_('common.apply')}
      >
        <Icon data={check} />
      </button>
      <button
        class="action-btn reject"
        onclick={handleReject}
        disabled={isApplied || isRejected}
        title={$_('common.reject')}
      >
        <Icon data={times} />
      </button>
    </div>
  </div>

  <div class="suggestion-content">
    {#if suggestion.originalText !== suggestion.suggestedText}
      <div class="text-change">
        <div class="original">
          <span class="label">{$_('transcript.suggestion.original')}:</span>
          <span class="text">{suggestion.originalText}</span>
        </div>
        <div class="suggested">
          <span class="label">{$_('transcript.suggestion.suggested')}:</span>
          <span class="text">{suggestion.suggestedText}</span>
        </div>
      </div>
    {/if}
    
    <div class="explanation">
      {suggestion.explanation}
    </div>
  </div>

  {#if isApplied}
    <div class="status-overlay applied">
      <Icon data={check} />
      {$_('transcript.suggestion.applied')}
    </div>
  {:else if isRejected}
    <div class="status-overlay rejected">
      <Icon data={times} />
      {$_('transcript.suggestion.rejected')}
    </div>
  {/if}
</div>

<style>
  .suggestion-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    position: relative;
    transition: all 0.2s;
  }

  .suggestion-card:hover:not(.applied):not(.rejected) {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border-color: #d1d5db;
  }

  .suggestion-card.applied {
    opacity: 0.7;
    background: #f0fdf4;
  }

  .suggestion-card.rejected {
    opacity: 0.7;
    background: #fef2f2;
  }

  .suggestion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .suggestion-type {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
  }

  .type-label {
    font-weight: 500;
    color: #374151;
  }

  .confidence {
    color: #6b7280;
    font-size: 0.75rem;
  }

  .suggestion-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    background: #f3f4f6;
    color: #6b7280;
  }

  .action-btn:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.apply:hover:not(:disabled) {
    background: #dcfce7;
    color: #16a34a;
  }

  .action-btn.reject:hover:not(:disabled) {
    background: #fee2e2;
    color: #dc2626;
  }

  .suggestion-content {
    font-size: 0.875rem;
  }

  .text-change {
    margin-bottom: 0.5rem;
  }

  .original,
  .suggested {
    margin-bottom: 0.25rem;
  }

  .label {
    font-weight: 500;
    color: #6b7280;
    margin-right: 0.25rem;
  }

  .original .text {
    text-decoration: line-through;
    color: #dc2626;
  }

  .suggested .text {
    color: #16a34a;
    font-weight: 500;
  }

  .explanation {
    color: #4b5563;
    line-height: 1.4;
  }

  .status-overlay {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .status-overlay.applied {
    color: #16a34a;
    background: #dcfce7;
  }

  .status-overlay.rejected {
    color: #dc2626;
    background: #fee2e2;
  }
</style>