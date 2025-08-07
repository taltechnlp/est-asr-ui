import type { Editor } from '@tiptap/core';
import type { ImprovementSuggestion } from '$lib/agents/schemas/transcript';
import { findAndCreateDiff } from '$lib/services/transcriptTextReplaceDiff';
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
    // Create a diff node for user review instead of directly replacing text
    const diffResult = findAndCreateDiff(
      editor,
      suggestion.originalText,
      suggestion.suggestedText,
      {
        caseSensitive: false,
        changeType: suggestion.type,
        confidence: suggestion.confidence || 0.5,
        context: suggestion.explanation || suggestion.text
      }
    );
    
    if (diffResult.success) {
      return {
        success: true,
        message: `Created diff for ${suggestion.type} suggestion. Please review and approve/reject.`,
        requiresUserInput: true
      };
    } else {
      // Handle specific error cases
      if (diffResult.error?.includes('Multiple matches found')) {
        return {
          success: false,
          message: diffResult.error,
          requiresUserInput: true,
        };
      }
      
      return {
        success: false,
        message: diffResult.error || 'Failed to create diff for suggestion.',
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