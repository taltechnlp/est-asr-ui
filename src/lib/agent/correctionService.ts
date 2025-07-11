import type { Editor } from '@tiptap/core';
import { ConvexClient } from 'convex/browser';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';
import { api } from '../../../convex/_generated/api';

const client = new ConvexClient(import.meta.env.VITE_CONVEX_URL || "http://localhost:3210");
const dmp = new diff_match_patch();

/**
 * Initiates the correction process for a document.
 * @param documentId The ID of the document to correct.
 * @param editorState The current state of the TipTap editor.
 */
export async function initiateCorrection(documentId: string, editorState: any): Promise<string> {
  const convexDocumentId = await client.mutation(api.documents.create, { 
    _id: documentId,
    title: "My Document", 
    editorState: editorState,
    status: "reviewing"
  });
  return convexDocumentId;
}

/**
 * Sends a segment of the document to the agent for correction.
 * @param documentId The Convex document ID.
 * @param editor The TipTap editor instance.
 */
export async function sendSegmentForCorrection(documentId: string, editor: Editor) {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to);

  // Find the speaker block containing the selection
  let speaker = "Unknown Speaker";
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'transcription_block') {
      speaker = node.attrs.speakerName;
      return false; // Stop searching
    }
  });

  await client.mutation(api.correctionJobs.create, {
    documentId: documentId as any, // Cast to Convex ID type
    originalText: text,
    speaker: speaker,
    status: "pending",
    tiptapNodePath: { from, to },
  });
}

/**
 * Applies a correction from the agent to the editor.
 * @param editor The TipTap editor instance.
 * @param job The correction job from Convex.
 */
export async function applyCorrection(editor: Editor, job: any) {
  const { from, to } = job.tiptapNodePath;
  const originalText = job.originalText;
  const correctedText = job.correctedText;

  const diffs = dmp.diff_main(originalText, correctedText);
  dmp.diff_cleanupSemantic(diffs);

  let position = from;
  editor.chain().focus().deleteRange({ from, to }).run();

  for (const [op, text] of diffs) {
    const end = position + text.length;
    switch (op) {
      case DIFF_INSERT:
        editor.chain().insertContentAt(position, text).setMark('suggestion', { suggestionType: 'insertion' }).run();
        break;
      case DIFF_DELETE:
        editor.chain().insertContentAt(position, text).setMark('suggestion', { suggestionType: 'deletion' }).run();
        break;
      case DIFF_EQUAL:
        editor.chain().insertContentAt(position, text).run();
        break;
    }
    position = end;
  }
}