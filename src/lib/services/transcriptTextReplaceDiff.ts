import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model';
import { findTextWithNodesBetween, type TextMatch } from './transcriptTextReplaceNodesBetween';
import { findTextFlexible } from './transcriptTextReplaceFlexible';

export interface DiffReplacementResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  diffId?: string;
  appliedAt?: number;
}

/**
 * Create a diff node instead of directly replacing text
 * This allows users to review and approve/reject changes
 */
export function createDiffNode(
  editor: Editor,
  match: TextMatch,
  suggestedText: string,
  changeType: string = 'text_replacement',
  confidence: number = 0.5,
  context?: string
): DiffReplacementResult {
  try {
    const diffId = `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const success = editor.chain().focus().command(({ tr, state }) => {
      // Check if diff node type exists
      if (!state.schema.nodes.diff) {
        console.error('Diff node type not registered in schema');
        return false;
      }
      
      // Create diff node with all necessary attributes
      const diffNode = state.schema.nodes.diff.create({
        id: diffId,
        originalText: match.text,
        suggestedText,
        changeType,
        confidence,
        context: context || '',
        from: match.from,
        to: match.to
      });
      
      if (!diffNode) {
        console.error('Failed to create diff node');
        return false;
      }
      
      // Replace the matched range with the diff node
      // The diff node will show both original and suggested text
      tr.replaceWith(match.from, match.to, diffNode);
      
      console.log(`Created diff node ${diffId} at ${match.from}-${match.to}`);
      console.log(`  Original: "${match.text}"`);
      console.log(`  Suggested: "${suggestedText}"`);
      
      return true;
    }).run();
    
    if (success) {
      return {
        success: true,
        diffId,
        appliedAt: match.from
      };
    } else {
      return {
        success: false,
        error: 'Failed to create diff node in editor'
      };
    }
  } catch (error) {
    console.error('Error creating diff node:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating diff node'
    };
  }
}

/**
 * Find text and create diff nodes for review (instead of direct replacement)
 */
export function findAndCreateDiff(
  editor: Editor,
  searchText: string,
  suggestedText: string,
  options: {
    caseSensitive?: boolean;
    from?: number;
    to?: number;
    changeType?: string;
    confidence?: number;
    context?: string;
    createAll?: boolean;
  } = {}
): DiffReplacementResult {
  const { 
    changeType = 'text_replacement',
    confidence = 0.5,
    context,
    createAll = false
  } = options;
  
  const { state } = editor;
  const { doc } = state;
  
  // Find matches using the robust nodesBetween approach
  let matches = findTextWithNodesBetween(doc, searchText, options);
  
  // If nodesBetween didn't find it, try flexible whitespace matching
  if (matches.length === 0) {
    console.log('NodesBetween found no matches, trying flexible search...');
    const flexibleMatches = findTextFlexible(doc, searchText, { caseSensitive: options.caseSensitive });
    
    // Convert flexible matches to the expected format
    if (flexibleMatches.length > 0) {
      matches = flexibleMatches.map(m => ({
        ...m,
        marks: new Set<Mark>() // Flexible search doesn't collect marks, but diff nodes don't need them
      }));
      console.log(`Flexible search found ${matches.length} matches`);
    }
  }
  
  if (matches.length === 0) {
    return {
      success: false,
      error: `Text "${searchText}" not found in document.`,
      matchCount: 0
    };
  }
  
  if (!createAll && matches.length > 1) {
    return {
      success: false,
      error: `Multiple matches found (${matches.length}). Please be more specific or enable createAll option.`,
      matchCount: matches.length
    };
  }
  
  // Create diff nodes for matches
  if (createAll) {
    // Create diff nodes for all matches from last to first to maintain positions
    let successCount = 0;
    let lastDiffId: string | undefined;
    
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const result = createDiffNode(editor, match, suggestedText, changeType, confidence, context);
      if (result.success) {
        successCount++;
        if (!lastDiffId && result.diffId) {
          lastDiffId = result.diffId;
        }
      }
    }
    
    return {
      success: successCount > 0,
      matchCount: successCount,
      diffId: lastDiffId,
      error: successCount === 0 ? 'Failed to create any diff nodes' : undefined
    };
  } else {
    // Create diff node for single match
    const match = matches[0];
    return createDiffNode(editor, match, suggestedText, changeType, confidence, context);
  }
}

/**
 * Helper to approve a diff node by ID
 */
export function approveDiff(editor: Editor, diffId: string): boolean {
  return editor.chain().focus().approveDiff(diffId).run();
}

/**
 * Helper to reject a diff node by ID
 */
export function rejectDiff(editor: Editor, diffId: string): boolean {
  return editor.chain().focus().rejectDiff(diffId).run();
}

/**
 * Get all diff nodes in the document
 */
export function getAllDiffNodes(doc: ProseMirrorNode): Array<{
  node: ProseMirrorNode;
  pos: number;
  id: string;
  originalText: string;
  suggestedText: string;
}> {
  const diffNodes: Array<{
    node: ProseMirrorNode;
    pos: number;
    id: string;
    originalText: string;
    suggestedText: string;
  }> = [];
  
  doc.descendants((node, pos) => {
    if (node.type.name === 'diff') {
      diffNodes.push({
        node,
        pos,
        id: node.attrs.id,
        originalText: node.attrs.originalText,
        suggestedText: node.attrs.suggestedText
      });
    }
  });
  
  return diffNodes;
}

/**
 * Approve all diff nodes in the document
 */
export function approveAllDiffs(editor: Editor): number {
  const doc = editor.state.doc;
  const diffNodes = getAllDiffNodes(doc);
  let approvedCount = 0;
  
  // Approve from last to first to maintain positions
  for (let i = diffNodes.length - 1; i >= 0; i--) {
    const diff = diffNodes[i];
    if (approveDiff(editor, diff.id)) {
      approvedCount++;
    }
  }
  
  return approvedCount;
}

/**
 * Reject all diff nodes in the document
 */
export function rejectAllDiffs(editor: Editor): number {
  const doc = editor.state.doc;
  const diffNodes = getAllDiffNodes(doc);
  let rejectedCount = 0;
  
  // Reject from last to first to maintain positions
  for (let i = diffNodes.length - 1; i >= 0; i--) {
    const diff = diffNodes[i];
    if (rejectDiff(editor, diff.id)) {
      rejectedCount++;
    }
  }
  
  return rejectedCount;
}