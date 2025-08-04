<script lang="ts">
  import type { TranscriptAnalysisResult } from '$lib/agents/schemas/transcript';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import chartLine from 'svelte-awesome/icons/lineChart';
  import users from 'svelte-awesome/icons/users';
  import file from 'svelte-awesome/icons/fileText';
  import clock from 'svelte-awesome/icons/clockO';
  import { _ } from 'svelte-i18n';

  let { analysisResult }: { analysisResult: TranscriptAnalysisResult } = $props();

  const qualityColor = $derived(
    analysisResult.overallQuality >= 0.8 ? '#16a34a' :
    analysisResult.overallQuality >= 0.6 ? '#f59e0b' : '#dc2626'
  );

  const qualityLabel = $derived(
    analysisResult.overallQuality >= 0.8 ? $_('transcript.quality.excellent') :
    analysisResult.overallQuality >= 0.6 ? $_('transcript.quality.good') :
    analysisResult.overallQuality >= 0.4 ? $_('transcript.quality.fair') :
    $_('transcript.quality.poor')
  );

  function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="analysis-panel">
  <div class="quality-score">
    <div class="score-circle" style="--quality-color: {qualityColor}">
      <span class="score-value">{Math.round(analysisResult.overallQuality * 100)}</span>
      <span class="score-percent">%</span>
    </div>
    <div class="quality-info">
      <h4>{$_('transcript.analysis.overallQuality')}</h4>
      <span class="quality-label" style="color: {qualityColor}">{qualityLabel}</span>
    </div>
  </div>

  <div class="metadata-grid">
    <div class="metadata-item">
      <Icon data={file} />
      <div>
        <span class="value">{analysisResult.metadata.totalWords}</span>
        <span class="label">{$_('transcript.metadata.words')}</span>
      </div>
    </div>
    
    <div class="metadata-item">
      <Icon data={users} />
      <div>
        <span class="value">{analysisResult.metadata.totalSpeakers}</span>
        <span class="label">{$_('transcript.metadata.speakers')}</span>
      </div>
    </div>
    
    {#if analysisResult.metadata.duration}
      <div class="metadata-item">
        <Icon data={clock} />
        <div>
          <span class="value">{formatDuration(analysisResult.metadata.duration)}</span>
          <span class="label">{$_('transcript.metadata.duration')}</span>
        </div>
      </div>
    {/if}
    
    <div class="metadata-item">
      <Icon data={chartLine} />
      <div>
        <span class="value">{analysisResult.suggestions.length}</span>
        <span class="label">{$_('transcript.metadata.suggestions')}</span>
      </div>
    </div>
  </div>

  {#if analysisResult.summary}
    <div class="summary">
      <h4>{$_('transcript.analysis.summary')}</h4>
      <p>{analysisResult.summary}</p>
    </div>
  {/if}
</div>

<style>
  .analysis-panel {
    background: #f9fafb;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .quality-score {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .score-circle {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: conic-gradient(
      var(--quality-color) calc(var(--quality-color) * 3.6deg),
      #e5e7eb 0deg
    );
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .score-circle::before {
    content: '';
    position: absolute;
    width: 3rem;
    height: 3rem;
    background: #f9fafb;
    border-radius: 50%;
  }

  .score-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    z-index: 1;
  }

  .score-percent {
    font-size: 0.75rem;
    color: #6b7280;
    z-index: 1;
  }

  .quality-info h4 {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .quality-label {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .metadata-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: white;
    border-radius: 6px;
    color: #6b7280;
  }

  .metadata-item > div {
    display: flex;
    flex-direction: column;
  }

  .metadata-item .value {
    font-weight: 600;
    color: #111827;
    font-size: 0.875rem;
  }

  .metadata-item .label {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .summary {
    background: white;
    padding: 0.75rem;
    border-radius: 6px;
  }

  .summary h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .summary p {
    margin: 0;
    font-size: 0.875rem;
    color: #4b5563;
    line-height: 1.5;
  }
</style>