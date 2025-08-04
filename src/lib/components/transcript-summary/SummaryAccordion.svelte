<script lang="ts">
  import { onMount } from 'svelte';
  import type { TranscriptSummary } from '@prisma/client';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import chevronDown from 'svelte-awesome/icons/chevronDown';
  import chevronUp from 'svelte-awesome/icons/chevronUp';
  import refresh from 'svelte-awesome/icons/refresh';
  import spinner from 'svelte-awesome/icons/spinner';
  import { _ } from 'svelte-i18n';

  let {
    fileId = '',
    onSummaryGenerated = (summary: TranscriptSummary) => {},
  } = $props();

  let isOpen = $state(false);
  let isLoading = $state(false);
  let isGenerating = $state(false);
  let summary = $state<TranscriptSummary | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    loadSummary();
  });

  async function loadSummary() {
    if (!fileId) return;
    
    isLoading = true;
    error = null;

    try {
      const response = await fetch(`/api/transcript-summary/${fileId}/`);
      
      if (response.ok) {
        summary = await response.json();
        // Notify parent component about loaded summary
        onSummaryGenerated(summary);
      } else if (response.status === 404) {
        // Summary doesn't exist yet - that's ok
        summary = null;
      } else {
        throw new Error('Failed to load summary');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load summary';
      console.error('Error loading summary:', err);
    } finally {
      isLoading = false;
    }
  }

  async function generateSummary(forceRegenerate = false) {
    if (!fileId || isGenerating) return;
    
    isGenerating = true;
    error = null;

    try {
      const response = await fetch('/api/transcript-summary/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          forceRegenerate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      summary = await response.json();
      onSummaryGenerated(summary);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to generate summary';
      console.error('Error generating summary:', err);
    } finally {
      isGenerating = false;
    }
  }

  function toggleAccordion() {
    isOpen = !isOpen;
  }

  function formatLanguage(lang: string): string {
    const languages = {
      et: 'Estonian',
      fi: 'Finnish',
      en: 'English',
    };
    return languages[lang as keyof typeof languages] || lang;
  }
</script>

<div class="summary-accordion">
  <div class="accordion-header">
    <button
      class="accordion-toggle"
      onclick={toggleAccordion}
      disabled={!summary && !isGenerating}
      aria-expanded={isOpen}
    >
      <Icon data={isOpen ? chevronUp : chevronDown} />
      <h3>{$_('transcript.summary.title')}</h3>
    </button>

    <div class="header-actions">
      {#if summary}
        <button
          class="regenerate-btn"
          onclick={() => generateSummary(true)}
          disabled={isGenerating}
          title={$_('transcript.summary.regenerate')}
        >
          <Icon data={refresh} spin={isGenerating} />
        </button>
      {:else if !isGenerating && !isLoading}
        <button
          class="generate-btn"
          onclick={() => generateSummary(false)}
        >
          {$_('transcript.summary.generate')}
        </button>
      {/if}

      {#if isGenerating}
        <div class="status">
          <Icon data={spinner} spin />
          <span>{$_('transcript.summary.generating')}</span>
        </div>
      {/if}
    </div>
  </div>

  {#if isOpen && summary}
    <div class="accordion-content">
      <div class="summary-section">
        <h4>{$_('transcript.summary.overview')}</h4>
        <p class="summary-text">{summary.summary}</p>
      </div>

      <div class="metadata-section">
        <div class="metadata-item">
          <span class="label">{$_('transcript.summary.language')}:</span>
          <span class="value">{formatLanguage(summary.language)}</span>
        </div>
        <div class="metadata-item">
          <span class="label">{$_('transcript.summary.speakers')}:</span>
          <span class="value">{summary.speakerCount}</span>
        </div>
      </div>

      <div class="topics-section">
        <h4>{$_('transcript.summary.keyTopics')}</h4>
        <div class="topics-list">
          {#each summary.keyTopics as topic}
            <span class="topic-tag">{topic}</span>
          {/each}
        </div>
      </div>

      <div class="timestamp">
        <small>
          {$_('transcript.summary.generatedAt')}: 
          {new Date(summary.createdAt).toLocaleString()}
        </small>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="error-message">
      <p>{error}</p>
    </div>
  {/if}
</div>

<style>
  .summary-accordion {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .accordion-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-size: 1rem;
    color: #374151;
    transition: color 0.2s;
  }

  .accordion-toggle:hover:not(:disabled) {
    color: #1f2937;
  }

  .accordion-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .accordion-toggle h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .generate-btn,
  .regenerate-btn {
    padding: 0.5rem 1rem;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .regenerate-btn {
    padding: 0.5rem;
    background: transparent;
    color: #6b7280;
    border: 1px solid #e5e7eb;
  }

  .generate-btn:hover,
  .regenerate-btn:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }

  .regenerate-btn:hover:not(:disabled) {
    background: #f3f4f6;
    color: #374151;
  }

  .generate-btn:disabled,
  .regenerate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .accordion-content {
    padding: 1.5rem;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .summary-section {
    margin-bottom: 1.5rem;
  }

  .summary-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-text {
    margin: 0;
    line-height: 1.6;
    color: #4b5563;
  }

  .metadata-section {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 6px;
  }

  .metadata-item {
    display: flex;
    gap: 0.5rem;
  }

  .metadata-item .label {
    font-weight: 500;
    color: #374151;
  }

  .metadata-item .value {
    color: #6b7280;
  }

  .topics-section {
    margin-bottom: 1rem;
  }

  .topics-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .topics-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .topic-tag {
    padding: 0.25rem 0.75rem;
    background: #e0e7ff;
    color: #4338ca;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .timestamp {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    color: #9ca3af;
  }

  .error-message {
    padding: 1rem;
    background: #fee;
    color: #c53030;
    border-top: 1px solid #fcc;
  }

  .error-message p {
    margin: 0;
  }
</style>