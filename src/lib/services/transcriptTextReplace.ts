import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { ImprovementSuggestion } from '$lib/agents/schemas/transcript';

export interface TextMatch {
  from: number;
  to: number;
  text: string;
  context: string;
  nodeType: string;
  speakerId?: string;
}

export interface ReplacementResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  replacedAt?: number;
}

/**
 * Find all occurrences of text in the document
 */
export function findTextPositions(
  doc: ProseMirrorNode,
  searchText: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    segmentId?: string;
  } = {}
): TextMatch[] {
  const matches: TextMatch[] = [];
  const { caseSensitive = false, wholeWord = false, segmentId } = options;
  
  const normalizedSearch = caseSensitive ? searchText : searchText.toLowerCase();
  
  doc.descendants((node, pos) => {
    // If segmentId is specified, only search within that speaker segment
    if (segmentId && node.type.name === 'speaker' && node.attrs.id !== segmentId) {
      return false; // Skip this branch
    }
    
    if (node.isText && node.text) {
      const nodeText = caseSensitive ? node.text : node.text.toLowerCase();
      let searchIndex = 0;
      
      while (searchIndex < nodeText.length) {
        const matchIndex = nodeText.indexOf(normalizedSearch, searchIndex);
        
        if (matchIndex === -1) break;
        
        // Check for whole word match if required
        if (wholeWord) {
          const beforeChar = matchIndex > 0 ? nodeText[matchIndex - 1] : ' ';
          const afterChar = matchIndex + normalizedSearch.length < nodeText.length 
            ? nodeText[matchIndex + normalizedSearch.length] 
            : ' ';
          
          if (/\w/.test(beforeChar) || /\w/.test(afterChar)) {
            searchIndex = matchIndex + 1;
            continue;
          }
        }
        
        const from = pos + matchIndex;
        const to = from + searchText.length;
        
        // Get context (50 chars before and after)
        const contextStart = Math.max(0, matchIndex - 50);
        const contextEnd = Math.min(node.text.length, matchIndex + searchText.length + 50);
        const context = node.text.substring(contextStart, contextEnd);
        
        // Find parent speaker node if exists
        let speakerId: string | undefined;
        let parentPos = pos;
        doc.nodesBetween(from, from, (n, p) => {
          if (n.type.name === 'speaker') {
            speakerId = n.attrs.id;
            return false;
          }
        });
        
        matches.push({
          from,
          to,
          text: node.text.substring(matchIndex, matchIndex + searchText.length),
          context,
          nodeType: node.type.name,
          speakerId,
        });
        
        searchIndex = matchIndex + searchText.length;
      }
    }
  });
  
  return matches;
}

/**
 * Apply text replacement at a specific position
 */
export function applyTextReplacement(
  editor: Editor,
  from: number,
  to: number,
  replacement: string,
  preserveMarks: boolean = true
): boolean {
  try {
    editor.chain().focus().command(({ tr, state }) => {
      // Get marks at the position if we need to preserve them
      let marks = null;
      if (preserveMarks) {
        const $from = state.doc.resolve(from);
        marks = $from.marks();
      }
      
      // Replace the text
      tr.replaceWith(from, to, state.schema.text(replacement, marks));
      
      return true;
    }).run();
    
    return true;
  } catch (error) {
    console.error('Failed to apply text replacement:', error);
    return false;
  }
}

/**
 * Apply suggestion to the editor
 */
export async function applySuggestionToEditor(
  editor: Editor,
  suggestion: ImprovementSuggestion
): Promise<ReplacementResult> {
  if (!editor || !editor.state) {
    return { success: false, error: 'Editor not available' };
  }
  
  const { originalText, suggestedText, segmentId, startOffset, endOffset } = suggestion;
  
  // Handle different suggestion types
  switch (suggestion.type) {
    case 'speaker_change':
      return handleSpeakerChange(editor, suggestion);
    
    case 'punctuation':
    case 'grammar':
    case 'context_error':
    case 'formatting':
      return handleTextReplacement(editor, suggestion);
    
    case 'low_confidence':
      // Low confidence suggestions might need manual review
      return { 
        success: false, 
        error: 'Low confidence suggestions require manual review' 
      };
    
    default:
      return handleTextReplacement(editor, suggestion);
  }
}

/**
 * Handle text replacement suggestions
 */
function handleTextReplacement(
  editor: Editor,
  suggestion: ImprovementSuggestion
): ReplacementResult {
  const { originalText, suggestedText, segmentId, startOffset, endOffset } = suggestion;
  
  // If we have exact positions, use them
  if (startOffset !== undefined && endOffset !== undefined) {
    const success = applyTextReplacement(editor, startOffset, endOffset, suggestedText);
    return { 
      success, 
      replacedAt: startOffset,
      error: success ? undefined : 'Failed to replace at specified position' 
    };
  }
  
  // Otherwise, search for the text
  const matches = findTextPositions(editor.state.doc, originalText, {
    caseSensitive: false,
    segmentId,
  });
  
  if (matches.length === 0) {
    return { success: false, error: 'Text not found in document', matchCount: 0 };
  }
  
  if (matches.length > 1) {
    return { 
      success: false, 
      error: 'Multiple matches found. Please be more specific.', 
      matchCount: matches.length 
    };
  }
  
  // Apply the replacement
  const match = matches[0];
  const success = applyTextReplacement(editor, match.from, match.to, suggestedText);
  
  return { 
    success, 
    replacedAt: match.from,
    error: success ? undefined : 'Failed to apply replacement' 
  };
}

/**
 * Handle speaker change suggestions
 */
function handleSpeakerChange(
  editor: Editor,
  suggestion: ImprovementSuggestion
): ReplacementResult {
  const { segmentId, suggestedText } = suggestion;
  
  if (!segmentId) {
    return { success: false, error: 'No segment ID provided for speaker change' };
  }
  
  // Find the speaker node
  let found = false;
  let nodePos = -1;
  
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'speaker' && node.attrs.id === segmentId) {
      found = true;
      nodePos = pos;
      return false; // Stop searching
    }
  });
  
  if (!found) {
    return { success: false, error: 'Speaker segment not found' };
  }
  
  // Update speaker attribute
  editor.chain().focus().command(({ tr }) => {
    tr.setNodeMarkup(nodePos, null, {
      ...editor.state.doc.nodeAt(nodePos)?.attrs,
      'data-name': suggestedText,
    });
    return true;
  }).run();
  
  return { success: true, replacedAt: nodePos };
}