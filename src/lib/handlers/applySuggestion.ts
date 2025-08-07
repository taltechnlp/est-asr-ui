import type { Editor } from '@tiptap/core';
import type { ImprovementSuggestion } from '$lib/agents/schemas/transcript';
import { applySuggestionToEditor, type ReplacementResult } from '$lib/services/transcriptTextReplace';
import { findAndReplaceText } from '$lib/services/transcriptTextReplaceProseMirror';
import { findAndReplaceTextSimple } from '$lib/services/transcriptTextReplaceProseMirrorSimple';
import { findAndReplaceWithNodesBetween } from '$lib/services/transcriptTextReplaceNodesBetween';
import { get } from 'svelte/store';
import { editor as editorStore } from '$lib/stores.svelte';

export interface SuggestionApplicationResult {
  success: boolean;
  message: string;
  requiresUserInput?: boolean;
  options?: Array<{
    id: string;
    text: string;
    context: string;
  }>;
}

/**
 * Main handler for applying suggestions from the transcript analysis
 */
export async function applySuggestion(
  suggestion: ImprovementSuggestion,
  editorOverride?: Editor
): Promise<SuggestionApplicationResult> {
  // Get editor instance
  const editor = editorOverride || get(editorStore);
  
  if (!editor) {
    return {
      success: false,
      message: 'Editor not available. Please ensure the transcript is loaded.',
    };
  }
  
  // Validate suggestion
  if (!suggestion.originalText || !suggestion.suggestedText) {
    return {
      success: false,
      message: 'Invalid suggestion: missing original or suggested text.',
    };
  }
  
  try {
    // First try the robust nodesBetween approach
    const nodesBetweenResult = findAndReplaceWithNodesBetween(
      editor,
      suggestion.originalText,
      suggestion.suggestedText,
      { caseSensitive: false }
    );
    
    if (nodesBetweenResult.success) {
      return {
        success: true,
        message: `Successfully applied ${suggestion.type} suggestion.`,
      };
    }
    
    // Try the simple approach as fallback
    console.log('NodesBetween approach failed, trying simple approach...');
    const simpleResult = findAndReplaceTextSimple(
      editor,
      suggestion.originalText,
      suggestion.suggestedText,
      { caseSensitive: false }
    );
    
    if (simpleResult.success) {
      return {
        success: true,
        message: `Successfully applied ${suggestion.type} suggestion.`,
      };
    }
    
    // Try ProseMirror utils approach
    console.log('Simple approach failed, trying ProseMirror utils...');
    const pmResult = findAndReplaceText(
      editor,
      suggestion.originalText,
      suggestion.suggestedText,
      { caseSensitive: false }
    );
    
    if (pmResult.success) {
      return {
        success: true,
        message: `Successfully applied ${suggestion.type} suggestion.`,
      };
    }
    
    // Fallback to the old approach
    console.log('ProseMirror utils approach failed, trying original fallback...');
    const result = await applySuggestionToEditor(editor, suggestion);
    
    if (result.success) {
      return {
        success: true,
        message: `Successfully applied ${suggestion.type} suggestion.`,
      };
    } else {
      // Handle specific error cases
      if (result.error?.includes('Multiple matches found')) {
        // In a future enhancement, we could return the matches for user selection
        return {
          success: false,
          message: result.error,
          requiresUserInput: true,
        };
      }
      
      return {
        success: false,
        message: result.error || 'Failed to apply suggestion.',
      };
    }
  } catch (error) {
    console.error('Error applying suggestion:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Apply multiple suggestions in sequence
 */
export async function applyMultipleSuggestions(
  suggestions: ImprovementSuggestion[],
  editorOverride?: Editor
): Promise<{
  applied: number;
  failed: number;
  results: SuggestionApplicationResult[];
}> {
  const results: SuggestionApplicationResult[] = [];
  let applied = 0;
  let failed = 0;
  
  // Sort suggestions by position (if available) to avoid conflicts
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const posA = a.startOffset ?? 0;
    const posB = b.startOffset ?? 0;
    return posB - posA; // Apply in reverse order to avoid position shifts
  });
  
  for (const suggestion of sortedSuggestions) {
    const result = await applySuggestion(suggestion, editorOverride);
    results.push(result);
    
    if (result.success) {
      applied++;
    } else {
      failed++;
    }
    
    // Add a small delay between applications to ensure editor state updates
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return { applied, failed, results };
}