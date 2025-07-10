<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { sendSegmentForCorrection } from '../agent/correctionService';

  export let editor: Editor;
  export let documentId: string;

  let isLoading = false;

  async function handleSendToAgent() {
    isLoading = true;
    try {
      await sendSegmentForCorrection(documentId, editor);
    } catch (error) {
      console.error('Error sending segment for correction:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="correction-controls">
  <button on:click={handleSendToAgent} disabled={isLoading}>
    {#if isLoading}
      <span>Sending...</span>
    {:else}
      <span>Send to Agent</span>
    {/if}
  </button>
</div>

<style>
  .correction-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
</style>
