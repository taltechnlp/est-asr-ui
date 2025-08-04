<script lang="ts">
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import checkCircle from 'svelte-awesome/icons/checkCircle';
  import exclamationCircle from 'svelte-awesome/icons/exclamationCircle';
  import exclamationTriangle from 'svelte-awesome/icons/exclamationTriangle';
  import times from 'svelte-awesome/icons/times';
  import { fade, slide } from 'svelte/transition';

  let { 
    type = 'success',
    message = '',
    onClose = () => {}
  }: {
    type: 'success' | 'error' | 'warning';
    message: string;
    onClose?: () => void;
  } = $props();

  const icons = {
    success: checkCircle,
    error: exclamationCircle,
    warning: exclamationTriangle,
  };

  const colors = {
    success: '#16a34a',
    error: '#dc2626',
    warning: '#f59e0b',
  };

  const bgColors = {
    success: '#f0fdf4',
    error: '#fef2f2',
    warning: '#fffbeb',
  };

  const borderColors = {
    success: '#86efac',
    error: '#fecaca',
    warning: '#fde68a',
  };
</script>

<div 
  class="feedback-container"
  style="--bg-color: {bgColors[type]}; --border-color: {borderColors[type]}; --text-color: {colors[type]}"
  transition:slide={{ duration: 200 }}
>
  <div class="feedback-content">
    <Icon 
      data={icons[type]} 
      style="color: {colors[type]}"
      class="feedback-icon"
    />
    <p class="feedback-message">{message}</p>
    <button
      class="close-btn"
      onclick={onClose}
      aria-label="Close"
    >
      <Icon data={times} />
    </button>
  </div>
</div>

<style>
  .feedback-container {
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .feedback-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }

  :global(.feedback-icon) {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
  }

  .feedback-message {
    flex: 1;
    margin: 0;
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.4;
  }

  .close-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    color: #6b7280;
    transition: color 0.2s;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: #374151;
    background: rgba(0, 0, 0, 0.05);
  }
</style>