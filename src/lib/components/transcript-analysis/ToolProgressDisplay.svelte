<script lang="ts">
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import check from 'svelte-awesome/icons/check';
  import times from 'svelte-awesome/icons/times';
  import spinner from 'svelte-awesome/icons/spinner';
  import microphone from 'svelte-awesome/icons/microphone';
  import search from 'svelte-awesome/icons/search';
  import lightbulbO from 'svelte-awesome/icons/lightbulbO';
  import magic from 'svelte-awesome/icons/magic';
  import crosshairs from 'svelte-awesome/icons/crosshairs';
  import clock from 'svelte-awesome/icons/clockO';
  import { TOOL_METADATA, type ToolProgress, type ToolStatus } from '$lib/agents/tools/toolMetadata';
  import { _ } from 'svelte-i18n';
  
  let {
    toolProgress = [] as ToolProgress[],
    showCompleted = true
  } = $props();
  
  function getIcon(iconName: string | undefined) {
    switch (iconName) {
      case 'microphone':
        return microphone;
      case 'search':
        return search;
      case 'brain':
        return lightbulbO;
      case 'sparkles':
        return magic;
      case 'target':
        return crosshairs;
      default:
        return lightbulbO;
    }
  }
  
  function getStatusIcon(status: ToolStatus) {
    switch (status) {
      case 'completed':
        return check;
      case 'error':
        return times;
      case 'running':
        return spinner;
      default:
        return clock;
    }
  }
  
  function getStatusColor(status: ToolStatus) {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'running':
        return '#3b82f6';
      case 'skipped':
        return '#9ca3af';
      default:
        return '#6b7280';
    }
  }
  
  function formatDuration(startTime?: number, endTime?: number): string {
    if (!startTime) return '';
    const end = endTime || Date.now();
    const duration = (end - startTime) / 1000;
    return `${duration.toFixed(1)}s`;
  }
  
  $: visibleProgress = showCompleted 
    ? toolProgress 
    : toolProgress.filter(p => p.status !== 'completed');
  
  function getToolName(toolId: string): string {
    const translationKey = getToolTranslationKey(toolId);
    if (translationKey) {
      return $_(`transcript.analysis.tools.${translationKey}`);
    }
    return TOOL_METADATA[toolId]?.displayName || toolId;
  }
  
  function getToolDescription(toolId: string): string {
    const translationKey = getToolTranslationKey(toolId);
    if (translationKey) {
      return $_(`transcript.analysis.tools.${translationKey}Desc`);
    }
    return TOOL_METADATA[toolId]?.description || '';
  }
  
  function getToolTranslationKey(toolId: string): string | null {
    const keyMap: Record<string, string> = {
      'asr_nbest': 'speechRecognition',
      'web_search': 'factChecking',
      'llm_analysis': 'languageAnalysis',
      'enhanced_analysis': 'enhancedAnalysis',
      'position_mapping': 'positionTracking'
    };
    return keyMap[toolId] || null;
  }
</script>

{#if visibleProgress.length > 0}
  <div class="tool-progress">
    <h5 class="progress-title">{$_('transcript.analysis.analysisSteps')}</h5>
    <div class="tool-list">
      {#each visibleProgress as progress}
        {#if TOOL_METADATA[progress.toolId]}
          {@const metadata = TOOL_METADATA[progress.toolId]}
          <div class="tool-item {progress.status}">
            <div class="tool-icon">
              <Icon 
                data={getIcon(metadata.icon)} 
                scale={0.8}
                style="color: {getStatusColor(progress.status)}"
              />
            </div>
            <div class="tool-content">
              <div class="tool-header">
                <span class="tool-name">{getToolName(progress.toolId)}</span>
                <div class="tool-status">
                  {#if progress.status === 'running'}
                    <Icon data={spinner} spin scale={0.7} />
                  {:else if progress.status === 'completed'}
                    <Icon data={check} scale={0.7} style="color: #10b981" />
                  {:else if progress.status === 'error'}
                    <Icon data={times} scale={0.7} style="color: #ef4444" />
                  {/if}
                  {#if progress.startTime && (progress.status === 'completed' || progress.status === 'error')}
                    <span class="duration">{formatDuration(progress.startTime, progress.endTime)}</span>
                  {:else if progress.status === 'pending' && metadata.estimatedDuration}
                    <span class="duration estimated">~{metadata.estimatedDuration}</span>
                  {/if}
                </div>
              </div>
              <p class="tool-description">{getToolDescription(progress.toolId)}</p>
              {#if progress.error}
                <p class="tool-error">{progress.error}</p>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .tool-progress {
    margin: 1rem 0;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }
  
  .progress-title {
    margin: 0 0 0.75rem 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .tool-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .tool-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem;
    background: white;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
    transition: all 0.2s;
  }
  
  .tool-item.running {
    border-color: #93c5fd;
    background: #eff6ff;
  }
  
  .tool-item.completed {
    opacity: 0.8;
  }
  
  .tool-item.error {
    border-color: #fca5a5;
    background: #fef2f2;
  }
  
  .tool-item.skipped {
    opacity: 0.5;
  }
  
  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }
  
  .tool-content {
    flex: 1;
    min-width: 0;
  }
  
  .tool-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }
  
  .tool-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .tool-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .duration {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .duration.estimated {
    color: #9ca3af;
    font-style: italic;
  }
  
  .tool-description {
    margin: 0;
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
  }
  
  .tool-error {
    margin: 0.25rem 0 0 0;
    font-size: 0.75rem;
    color: #dc2626;
    line-height: 1.4;
  }
</style>