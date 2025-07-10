<script lang="ts">
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { onMount } from 'svelte';
  import CorrectionControls from './CorrectionControls.svelte';
  import { Suggestion } from './nodes/suggestion';
  import { applyCorrection } from '../agent/correctionService';
  import { ConvexClient } from 'convex/browser';

  export let documentId: string;

  let element: HTMLDivElement;
  let editor: Editor;

  const client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

  onMount(() => {
    editor = new Editor({
      element: element,
      extensions: [
        StarterKit,
        Suggestion,
      ],
      content: '<p>Hello World!</p>',
    });

    const unsubscribe = client.onUpdate(
      "correctionJobs",
      { documentId: documentId, status: "completed" },
      (job) => {
        applyCorrection(editor, job);
      }
    );

    return () => {
      editor.destroy();
      unsubscribe();
    };
  });
</script>

<div class="editor-container">
    {#if editor}
    <CorrectionControls {editor} {documentId} />
  {/if}
  <div bind:this={element}></div>
</div>

<style>
  .editor-container {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1rem;
  }
</style>
