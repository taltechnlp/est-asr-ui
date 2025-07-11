<script lang="ts">
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { onMount } from 'svelte';
  import CorrectionControls from './CorrectionControls.svelte';
  import { Suggestion } from './nodes/suggestion';
  import { applyCorrection } from '../agent/correctionService';
  import { ConvexClient } from 'convex/browser';
  import { api } from '../../../convex/_generated/api';

  export let documentId: string;
  export let convexDocumentId: string | null = null;
  export let editor: Editor | undefined = undefined;

  let element: HTMLDivElement;
  let editorInstance: Editor;

  const client = new ConvexClient(import.meta.env.VITE_CONVEX_URL || "http://localhost:3210");

  onMount(() => {
    editorInstance = new Editor({
      element: element,
      extensions: [
        StarterKit,
        Suggestion,
      ],
      content: '<p>Hello World!</p>',
    });

    // Bind the editor instance to the parent component
    editor = editorInstance;

    if (convexDocumentId) {
      const unsubscribe = client.onUpdate(
        api.correctionJobs.getByDocumentAndStatus,
        { documentId: convexDocumentId as any, status: "completed" },
        (job) => {
          applyCorrection(editorInstance, job);
        }
      );

      return () => {
        editorInstance.destroy();
        unsubscribe();
      };
    }

    return () => {
      editorInstance.destroy();
    };
  });
</script>

<div class="editor-container">
    {#if editor && convexDocumentId}
    <CorrectionControls {editor} {convexDocumentId} />
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
