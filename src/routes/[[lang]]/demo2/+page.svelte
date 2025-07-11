<script lang="ts">
  import TiptapEditor from "$lib/components/TiptapEditor.svelte";
  import { initiateCorrection } from "$lib/agent/correctionService";
  import type { Editor } from "@tiptap/core";

  let documentId = "demo-document-" + Math.random().toString(36).substring(7);
  let convexDocumentId: string | null = null;
  let editor: Editor | undefined;

  async function handleSave() {
    if (editor) {
      const editorState = editor.getJSON();
      convexDocumentId = await initiateCorrection(documentId, editorState);
      alert(`Document saved with ID: ${documentId}, Convex ID: ${convexDocumentId}`);
    }
  }
</script>

<h1>Tiptap Editor Demo</h1>

<TiptapEditor bind:editor {documentId} {convexDocumentId} />

<button on:click={handleSave} style="margin-top: 1rem;">
  Save to DB
</button>