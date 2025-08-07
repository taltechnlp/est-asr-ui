import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model';

export interface TextMatch {
  from: number;
  to: number;
  text: string;
  marks: Set<Mark>;
}

export interface ReplacementResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  replacedAt?: number;
}

/**
 * Normalize text for comparison - handles punctuation and whitespace
 */
function normalizeForSearch(text: string): string {
  // Normalize whitespace but preserve word boundaries
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Find text using doc.nodesBetween() for robust traversal
 * This approach properly handles text spanning multiple nodes
 */
export function findTextWithNodesBetween(
  doc: ProseMirrorNode,
  searchText: string,
  options: {
    from?: number;
    to?: number;
    caseSensitive?: boolean;
  } = {}
): TextMatch[] {
  const { 
    from = 0, 
    to = doc.content.size,
    caseSensitive = false 
  } = options;
  
  const matches: TextMatch[] = [];
  const searchNormalized = caseSensitive ? searchText : normalizeForSearch(searchText);
  const searchLength = searchText.length;
  
  console.log('\n=== NodesBetween Search ===');
  console.log('Searching for:', JSON.stringify(searchText));
  console.log('Search range:', from, 'to', to);
  
  // Build a buffer of text content as we traverse
  interface TextSegment {
    text: string;
    pos: number;
    marks: Mark[];
  }
  
  const textSegments: TextSegment[] = [];
  
  // First pass: collect all text segments with their positions and marks
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText && node.text) {
      textSegments.push({
        text: node.text,
        pos,
        marks: node.marks || []
      });
    }
  });
  
  console.log(`Collected ${textSegments.length} text segments`);
  
  // Second pass: build continuous text and find matches
  for (let i = 0; i < textSegments.length; i++) {
    // Build a string starting from this segment
    let accumulatedText = '';
    let accumulatedNormalized = '';
    const segmentStart = i;
    
    // Accumulate text from consecutive segments
    for (let j = i; j < textSegments.length; j++) {
      const segment = textSegments[j];
      
      // Check if segments are consecutive (or close enough with small gaps)
      if (j > i) {
        const prevSegment = textSegments[j - 1];
        const gap = segment.pos - (prevSegment.pos + prevSegment.text.length);
        
        // Allow small gaps (like between inline nodes)
        if (gap > 1) {
          // Add a space for the gap if it's reasonable
          if (gap <= 5) {
            accumulatedText += ' ';
            accumulatedNormalized += ' ';
          } else {
            // Gap too large, stop accumulating
            break;
          }
        }
      }
      
      accumulatedText += segment.text;
      accumulatedNormalized += caseSensitive ? segment.text : normalizeForSearch(segment.text);
      
      // Check if we have enough text to potentially match
      if (accumulatedText.length >= searchLength) {
        // Try to find the search text in the accumulated text
        const searchIn = caseSensitive ? accumulatedText : accumulatedNormalized;
        const matchIndex = searchIn.indexOf(searchNormalized);
        
        if (matchIndex !== -1) {
          console.log(`Found match at accumulated position ${matchIndex}`);
          
          // Calculate the actual document positions
          let charCount = 0;
          let matchFrom = -1;
          let matchTo = -1;
          const matchMarks = new Set<Mark>();
          
          // Find the exact positions in the segments
          for (let k = segmentStart; k <= j; k++) {
            const seg = textSegments[k];
            const segmentLength = seg.text.length;
            
            // Add space for gaps if needed
            if (k > segmentStart) {
              const prevSeg = textSegments[k - 1];
              const gap = seg.pos - (prevSeg.pos + prevSeg.text.length);
              if (gap > 0 && gap <= 5) {
                charCount += 1; // We added a space for this gap
              }
            }
            
            // Check if match starts in this segment
            if (matchFrom === -1 && matchIndex < charCount + segmentLength) {
              matchFrom = seg.pos + Math.max(0, matchIndex - charCount);
            }
            
            // Check if match ends in this segment
            if (matchIndex + searchLength <= charCount + segmentLength) {
              matchTo = seg.pos + (matchIndex + searchLength - charCount);
              
              // Collect marks from all segments in the match
              for (let m = segmentStart; m <= k; m++) {
                textSegments[m].marks.forEach(mark => matchMarks.add(mark));
              }
              
              break;
            }
            
            // If we're within the match range, collect marks
            if (matchFrom !== -1) {
              seg.marks.forEach(mark => matchMarks.add(mark));
            }
            
            charCount += segmentLength;
          }
          
          if (matchFrom !== -1 && matchTo !== -1) {
            // Verify the match by getting the actual text
            const actualText = doc.textBetween(matchFrom, matchTo);
            console.log(`Match verification: "${actualText}" at ${matchFrom}-${matchTo}`);
            
            matches.push({
              from: matchFrom,
              to: matchTo,
              text: actualText,
              marks: matchMarks
            });
            
            // Skip past this match to find more
            i = j;
            break;
          }
        }
      }
      
      // Stop if accumulated text is already longer than search
      if (accumulatedText.length > searchLength * 2) {
        break;
      }
    }
  }
  
  console.log(`Found ${matches.length} matches using nodesBetween\n`);
  return matches;
}

/**
 * Apply text replacement preserving collected marks
 */
export function applyReplacementWithMarks(
  editor: Editor,
  match: TextMatch,
  replacementText: string
): boolean {
  try {
    return editor.chain().focus().command(({ tr, state }) => {
      // Convert Set to Array for mark application
      const marksArray = Array.from(match.marks);
      
      // Create the replacement text node with all collected marks
      const textNode = state.schema.text(replacementText, marksArray);
      
      // Replace the range with the new text
      tr.replaceWith(match.from, match.to, textNode);
      
      console.log(`Applied replacement at ${match.from}-${match.to} with ${marksArray.length} marks`);
      return true;
    }).run();
  } catch (error) {
    console.error('Failed to apply replacement:', error);
    return false;
  }
}

/**
 * Main function to find and replace text using nodesBetween approach
 */
export function findAndReplaceWithNodesBetween(
  editor: Editor,
  searchText: string,
  replacementText: string,
  options: {
    caseSensitive?: boolean;
    from?: number;
    to?: number;
    replaceAll?: boolean;
  } = {}
): ReplacementResult {
  const { state } = editor;
  const { doc } = state;
  const { replaceAll = false } = options;
  
  // Find matches using the robust nodesBetween approach
  const matches = findTextWithNodesBetween(doc, searchText, options);
  
  if (matches.length === 0) {
    return {
      success: false,
      error: `Text "${searchText}" not found in document.`,
      matchCount: 0
    };
  }
  
  if (!replaceAll && matches.length > 1) {
    return {
      success: false,
      error: `Multiple matches found (${matches.length}). Please be more specific or use replace all.`,
      matchCount: matches.length
    };
  }
  
  // Apply replacements
  if (replaceAll) {
    // Replace all matches from last to first to maintain positions
    let successCount = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (applyReplacementWithMarks(editor, match, replacementText)) {
        successCount++;
      }
    }
    
    return {
      success: successCount > 0,
      matchCount: successCount,
      error: successCount === 0 ? 'Failed to apply any replacements' : undefined
    };
  } else {
    // Replace single match
    const match = matches[0];
    const success = applyReplacementWithMarks(editor, match, replacementText);
    
    return {
      success,
      replacedAt: match.from,
      matchCount: 1,
      error: success ? undefined : 'Failed to apply replacement'
    };
  }
}

/**
 * Helper function to find text near a specific position
 * Useful for context-aware replacements
 */
export function findTextNearPosition(
  doc: ProseMirrorNode,
  searchText: string,
  nearPos: number,
  searchRadius: number = 100
): TextMatch | null {
  const from = Math.max(0, nearPos - searchRadius);
  const to = Math.min(doc.content.size, nearPos + searchRadius);
  
  const matches = findTextWithNodesBetween(doc, searchText, { from, to });
  
  if (matches.length === 0) {
    return null;
  }
  
  // Return the match closest to nearPos
  let closestMatch = matches[0];
  let closestDistance = Math.abs(matches[0].from - nearPos);
  
  for (const match of matches) {
    const distance = Math.abs(match.from - nearPos);
    if (distance < closestDistance) {
      closestMatch = match;
      closestDistance = distance;
    }
  }
  
  return closestMatch;
}

/**
 * Debug helper to visualize document structure between positions
 */
export function debugNodesBetween(
  doc: ProseMirrorNode,
  from: number = 0,
  to: number = doc.content.size
): void {
  console.group('🔍 Document Structure (nodesBetween)');
  console.log(`Range: ${from} to ${to}`);
  
  let nodeCount = 0;
  doc.nodesBetween(from, to, (node, pos, parent, index) => {
    const indent = '  '.repeat(parent ? 1 : 0);
    const nodeInfo = node.isText 
      ? `TEXT: "${node.text}" marks:[${node.marks?.map(m => m.type.name).join(',')}]`
      : `NODE: ${node.type.name}`;
    
    console.log(`${indent}[${nodeCount}] pos:${pos} ${nodeInfo}`);
    nodeCount++;
    
    // Return true to recurse into node's content
    return true;
  });
  
  console.log(`Total nodes in range: ${nodeCount}`);
  console.groupEnd();
}