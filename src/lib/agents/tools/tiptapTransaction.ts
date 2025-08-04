import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import { findTextPositions, type TextMatch } from '$lib/services/transcriptTextReplace';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

// Schema for the tool input
const TipTapTransactionSchema = z.object({
  originalText: z.string().describe("The original text to find and replace"),
  suggestedText: z.string().describe("The new text to replace it with"), 
  segmentId: z.string().optional().describe("Optional segment ID to limit search scope"),
  changeType: z.enum(['text_replacement', 'speaker_change', 'punctuation', 'grammar']).default('text_replacement').describe("Type of change being made"),
  confidence: z.number().min(0).max(1).describe("Confidence level of the suggested change"),
  context: z.string().optional().describe("Additional context about the change")
});

export type TipTapTransactionInput = z.infer<typeof TipTapTransactionSchema>;

export interface TipTapTransactionResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  appliedAt?: number;
  transactionId?: string;
  requiresApproval?: boolean;
}

export class TipTapTransactionTool extends TranscriptAnalysisTool {
  private editor: Editor | null = null;

  constructor() {
    const bindedApplyChange = (input: TipTapTransactionInput) => this.applyChange(input);
    
    super(
      "tiptap_transaction",
      `Apply text changes to the TipTap editor using ProseMirror transactions.
      
This tool can:
- Locate text within the editor document
- Create transactions to modify text while preserving marks
- Handle different types of changes (text replacement, speaker changes, etc.)
- Always create inline diff nodes for user approval before applying changes
- Return errors if multiple matches are found (requires more specific text)

The tool will return an error if more than one match is found for the original text, as requested.
All suggestions are shown as inline diffs that require user approval.`,
      TipTapTransactionSchema,
      bindedApplyChange
    );
  }

  setEditor(editor: Editor) {
    this.editor = editor;
  }

  private async applyChange(input: TipTapTransactionInput): Promise<string> {
    if (!this.editor) {
      const result: TipTapTransactionResult = {
        success: false,
        error: "TipTap editor not available"
      };
      return JSON.stringify(result);
    }

    const { originalText, suggestedText, segmentId, changeType, confidence, context } = input;

    try {
      // Find text positions using existing utility
      const matches: TextMatch[] = findTextPositions(this.editor.state.doc, originalText, {
        caseSensitive: false,
        segmentId,
      });

      // Check for multiple matches - return error as requested
      if (matches.length === 0) {
        // Provide more helpful debugging information
        const normalizedOriginal = originalText.replace(/\s+/g, ' ').trim();
        
        // Try to find similar text for better error reporting
        let allDocText = '';
        this.editor.state.doc.descendants((node) => {
          if (node.isText && node.text) {
            allDocText += node.text;
          }
        });
        
        const normalizedDocText = allDocText.replace(/\s+/g, ' ').trim().toLowerCase();
        const searchLower = normalizedOriginal.toLowerCase();
        
        // Check for partial matches
        const words = searchLower.split(' ');
        const foundWords = words.filter(word => normalizedDocText.includes(word));
        const missingWords = words.filter(word => !normalizedDocText.includes(word));
        
        let errorMsg = `Text "${originalText}" not found in document. Normalized search: "${normalizedOriginal}".`;
        
        if (foundWords.length > 0) {
          errorMsg += ` Found ${foundWords.length}/${words.length} words: [${foundWords.join(', ')}].`;
          if (missingWords.length > 0) {
            errorMsg += ` Missing words: [${missingWords.join(', ')}].`;
          }
        } else {
          errorMsg += ` None of the search words were found in the document.`;
        }
        
        // Check if text might span across nodes
        if (normalizedDocText.includes(searchLower)) {
          errorMsg += ` NOTE: Text found in full document text - attempted cross-node matching but failed. Text may span complex node structures or contain non-text elements.`;
        }
        
        const result: TipTapTransactionResult = {
          success: false,
          error: errorMsg,
          matchCount: 0
        };
        return JSON.stringify(result);
      }

      if (matches.length > 1) {
        const result: TipTapTransactionResult = {
          success: false,
          error: `Multiple matches found for "${originalText}". Found ${matches.length} occurrences. Please be more specific with the text to avoid ambiguity.`,
          matchCount: matches.length
        };
        return JSON.stringify(result);
      }

      const match = matches[0];

      // Always create diff node for user approval (removed auto-application)
      return await this.createDiffNode(match, suggestedText, changeType, confidence, context);

    } catch (error) {
      const result: TipTapTransactionResult = {
        success: false,
        error: `Failed to apply change: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      return JSON.stringify(result);
    }
  }


  private applyCrossNodeReplacement(
    tr: any,
    state: any,
    match: TextMatch,
    suggestedText: string
  ): boolean {
    try {
      // Get the range we're replacing
      const from = match.from;
      const to = match.to;
      
      // Collect marks from the start of the selection to preserve formatting
      const $from = state.doc.resolve(from);
      const startMarks = $from.marks();
      
      // For cross-node replacements, we need to be more careful about marks
      // Let's collect all unique marks within the range
      const allMarks = new Set();
      let currentPos = from;
      
      // Walk through the range and collect marks
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (node.isText) {
          // Add marks from this text node
          node.marks.forEach((mark: any) => allMarks.add(mark));
        }
      });
      
      // Convert Set back to array, prefer startMarks if available
      const marksToUse = startMarks.length > 0 ? startMarks : Array.from(allMarks);
      
      // Check if replacement spans multiple nodes by examining the content
      let spansMultipleNodes = false;
      let nodeCount = 0;
      
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (node.isText) {
          nodeCount++;
        }
      });
      
      spansMultipleNodes = nodeCount > 1;
      
      if (spansMultipleNodes) {
        // For multi-node replacement, we need to:
        // 1. Delete the entire range
        // 2. Insert the new text with appropriate marks
        
        // First, delete the range
        tr.delete(from, to);
        
        // Then insert the new text with preserved marks
        const newTextNode = state.schema.text(suggestedText, marksToUse);
        tr.insert(from, newTextNode);
        
        console.log(`Applied cross-node replacement: "${match.text}" -> "${suggestedText}" at ${from}-${to}`);
      } else {
        // Single node replacement (fallback to simple replacement)
        tr.replaceWith(from, to, state.schema.text(suggestedText, marksToUse));
      }
      
      return true;
    } catch (error) {
      console.error('Cross-node replacement failed:', error);
      
      // Fallback: try simple replacement
      try {
        const $from = state.doc.resolve(match.from);
        const marks = $from.marks();
        tr.replaceWith(match.from, match.to, state.schema.text(suggestedText, marks));
        console.log('Fallback simple replacement succeeded');
        return true;
      } catch (fallbackError) {
        console.error('Fallback replacement also failed:', fallbackError);
        return false;
      }
    }
  }


  private async createDiffNode(
    match: TextMatch,
    suggestedText: string,
    changeType: string,
    confidence: number,
    context?: string
  ): Promise<string> {
    try {
      // Insert a diff node at the match position
      const diffId = `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const success = this.editor!.chain().focus().command(({ tr, state }) => {
        // Create diff node with original and suggested text
        const diffNode = state.schema.nodes.diff?.create({
          id: diffId,
          originalText: match.text,
          suggestedText,
          changeType,
          confidence,
          context: context || '',
          from: match.from,
          to: match.to
        });

        if (diffNode) {
          // Use cross-node replacement logic for diff nodes too
          return this.applyCrossNodeDiffReplacement(tr, state, match, diffNode);
        }
        return false;
      }).run();

      const result: TipTapTransactionResult = {
        success,
        requiresApproval: true,
        transactionId: diffId,
        appliedAt: match.from
      };

      return JSON.stringify(result);
    } catch (error) {
      // Fallback: if diff node creation fails, create a simple replacement
      // This ensures the tool doesn't fail completely if diff node isn't available yet
      const result: TipTapTransactionResult = {
        success: false,
        error: `Diff node creation not yet implemented. Suggestion requires manual review: "${match.text}" -> "${suggestedText}"`,
        requiresApproval: true
      };
      return JSON.stringify(result);
    }
  }

  private applyCrossNodeDiffReplacement(
    tr: any,
    state: any,
    match: TextMatch,
    diffNode: any
  ): boolean {
    try {
      const from = match.from;
      const to = match.to;
      
      // Check if replacement spans multiple nodes
      let nodeCount = 0;
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (node.isText) {
          nodeCount++;
        }
      });
      
      const spansMultipleNodes = nodeCount > 1;
      
      if (spansMultipleNodes) {
        // For multi-node diff replacement:
        // 1. Delete the entire range
        // 2. Insert the diff node
        tr.delete(from, to);
        tr.insert(from, diffNode);
        
        console.log(`Applied cross-node diff replacement at ${from}-${to}`);
      } else {
        // Single node replacement
        tr.replaceWith(from, to, diffNode);
      }
      
      return true;
    } catch (error) {
      console.error('Cross-node diff replacement failed:', error);
      
      // Fallback: try simple replacement
      try {
        tr.replaceWith(match.from, match.to, diffNode);
        console.log('Fallback diff replacement succeeded');
        return true;
      } catch (fallbackError) {
        console.error('Fallback diff replacement also failed:', fallbackError);
        return false;
      }
    }
  }
}

export function createTipTapTransactionTool(): TipTapTransactionTool {
  return new TipTapTransactionTool();
}

// Add a direct call method that bypasses the protected _call
export class TipTapTransactionToolDirect {
  private tool: TipTapTransactionTool;

  constructor() {
    this.tool = new TipTapTransactionTool();
  }

  setEditor(editor: Editor) {
    this.tool.setEditor(editor);
  }

  async applyTransaction(input: TipTapTransactionInput): Promise<string> {
    return this.tool['applyChange'](input);
  }
}