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
 * Helper function to find the original position in text that has been normalized
 */
function findOriginalPosition(originalText: string, normalizedText: string, normalizedPos: number): number {
  let originalPos = 0;
  let normalizedIndex = 0;
  
  while (normalizedIndex < normalizedPos && originalPos < originalText.length) {
    const originalChar = originalText[originalPos];
    const normalizedChar = normalizedText[normalizedIndex];
    
    if (originalChar === normalizedChar) {
      // Characters match, advance both positions
      originalPos++;
      normalizedIndex++;
    } else if (/\s/.test(originalChar)) {
      // Original has whitespace, skip consecutive whitespace in original
      while (originalPos < originalText.length && /\s/.test(originalText[originalPos])) {
        originalPos++;
      }
      // Skip single space in normalized (which represents the consecutive whitespace)
      if (normalizedIndex < normalizedText.length && /\s/.test(normalizedText[normalizedIndex])) {
        normalizedIndex++;
      }
    } else {
      // This shouldn't happen in well-formed normalized text, but handle it
      originalPos++;
      normalizedIndex++;
    }
  }
  
  return originalPos;
}

/**
 * Convert string positions (from doc.textBetween) to ProseMirror document positions
 */
function convertStringToProseMirrorPositions(
  doc: ProseMirrorNode,
  stringFrom: number,
  stringTo: number
): { from: number; to: number } | null {
  let currentStringPos = 0;
  let fromPos: number | null = null;
  let toPos: number | null = null;
  
  doc.descendants((node, pos) => {
    if (fromPos !== null && toPos !== null) return false;
    
    if (node.isText && node.text) {
      const nodeStringStart = currentStringPos;
      const nodeStringEnd = currentStringPos + node.text.length;
      
      // Check if stringFrom falls within this node
      if (fromPos === null && stringFrom >= nodeStringStart && stringFrom < nodeStringEnd) {
        const offsetInNode = stringFrom - nodeStringStart;
        fromPos = pos + offsetInNode;
        console.log(`Found from position: string ${stringFrom} -> ProseMirror ${fromPos} (node ${nodeStringStart}-${nodeStringEnd})`);
      }
      
      // Check if stringTo falls within this node
      if (toPos === null && stringTo > nodeStringStart && stringTo <= nodeStringEnd) {
        const offsetInNode = stringTo - nodeStringStart;
        toPos = pos + offsetInNode;
        console.log(`Found to position: string ${stringTo} -> ProseMirror ${toPos} (node ${nodeStringStart}-${nodeStringEnd})`);
      }
      
      currentStringPos += node.text.length;
    }
  });
  
  if (fromPos !== null && toPos !== null) {
    console.log(`Successfully converted string positions ${stringFrom}-${stringTo} to ProseMirror ${fromPos}-${toPos}`);
    return { from: fromPos, to: toPos };
  } else {
    console.warn(`Failed to convert positions: fromPos=${fromPos}, toPos=${toPos}`);
    return null;
  }
}

/**
 * Simplified text search using ProseMirror's built-in search capabilities
 */
function findTextUsingProseMirrorSearch(
  doc: ProseMirrorNode,
  searchText: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    segmentId?: string;
  } = {}
): TextMatch[] {
  const { caseSensitive = false, segmentId } = options;
  const matches: TextMatch[] = [];
  
  console.log('ProseMirror search for original text:', JSON.stringify(searchText));
  
  // Use ProseMirror's textBetween to get all text content with positions
  const fullText = doc.textBetween(0, doc.content.size);
  const searchLower = caseSensitive ? searchText : searchText.toLowerCase();
  const fullTextLower = caseSensitive ? fullText : fullText.toLowerCase();
  
  console.log('Document text length:', fullText.length);
  console.log('Full document text (first 200 chars):', JSON.stringify(fullText.substring(0, 200)));
  
  // First try exact match (no normalization)
  let searchIndex = 0;
  while (searchIndex < fullTextLower.length) {
    const matchIndex = fullTextLower.indexOf(searchLower, searchIndex);
    if (matchIndex === -1) break;
    
    console.log(`Found exact text match at position ${matchIndex}: "${fullText.substring(matchIndex, matchIndex + searchText.length)}"`);
    
    // Validate that this is the full match we want
    const actualMatch = fullText.substring(matchIndex, matchIndex + searchText.length);
    if (actualMatch.toLowerCase() === searchLower) {
      // Convert string positions to ProseMirror document positions
      const proseMirrorPositions = convertStringToProseMirrorPositions(doc, matchIndex, matchIndex + searchText.length);
      if (proseMirrorPositions) {
        const { from, to } = proseMirrorPositions;
        
        // Get context using ProseMirror positions
        const contextStart = Math.max(1, from - 50);
        const contextEnd = Math.min(doc.content.size, to + 50);
        const context = doc.textBetween(contextStart, contextEnd);
        
        matches.push({
          from,
          to,
          text: actualMatch,
          context,
          nodeType: 'text',
          speakerId: undefined
        });
        
        console.log(`Successfully created exact match: ProseMirror ${from}-${to} = "${actualMatch}"`);
      } else {
        console.warn(`Failed to convert string positions ${matchIndex}-${matchIndex + searchText.length} to ProseMirror positions`);
      }
    }
    
    searchIndex = matchIndex + searchText.length;
  }
  
  // If no exact matches found, try with whitespace normalization
  if (matches.length === 0) {
    console.log('No exact matches found, trying with whitespace normalization');
    
    const normalizedSearchText = searchText.replace(/\s+/g, ' ').trim();
    const normalizedFullText = fullText.replace(/\s+/g, ' ').trim();
    const normalizedSearchLower = caseSensitive ? normalizedSearchText : normalizedSearchText.toLowerCase();
    const normalizedFullTextLower = caseSensitive ? normalizedFullText : normalizedFullText.toLowerCase();
    
    console.log('Normalized search text:', JSON.stringify(normalizedSearchText));
    console.log('Normalized document text (first 200 chars):', JSON.stringify(normalizedFullText.substring(0, 200)));
    
    searchIndex = 0;
    while (searchIndex < normalizedFullTextLower.length) {
      const matchIndex = normalizedFullTextLower.indexOf(normalizedSearchLower, searchIndex);
      if (matchIndex === -1) break;
      
      console.log(`Found normalized match at position ${matchIndex}`);
      
      // Now we need to map the normalized position back to the original text position
      // This is complex, so let's use a simpler approach: find the pattern with fuzzy matching
      const matchedNormalizedText = normalizedFullText.substring(matchIndex, matchIndex + normalizedSearchText.length);
      
      // Create a regex pattern that allows for flexible whitespace
      const regexPattern = searchText.replace(/\s+/g, '\\s+').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(regexPattern, caseSensitive ? 'g' : 'gi');
      
      console.log('Using regex pattern:', regexPattern);
      
      let regexMatch;
      while ((regexMatch = regex.exec(fullText)) !== null) {
        const stringFrom = regexMatch.index;
        const stringTo = regexMatch.index + regexMatch[0].length;
        const actualText = regexMatch[0];
        
        console.log(`Regex match found at string positions: ${stringFrom}-${stringTo} = "${actualText}"`);
        
        // Convert string positions to ProseMirror document positions
        const proseMirrorPositions = convertStringToProseMirrorPositions(doc, stringFrom, stringTo);
        if (proseMirrorPositions) {
          const { from, to } = proseMirrorPositions;
          
          // Get context using ProseMirror positions
          const contextStart = Math.max(1, from - 50);
          const contextEnd = Math.min(doc.content.size, to + 50);
          const context = doc.textBetween(contextStart, contextEnd);
          
          matches.push({
            from,
            to,
            text: actualText,
            context,
            nodeType: 'text',
            speakerId: undefined
          });
          
          console.log(`Successfully created regex match: ProseMirror ${from}-${to}`);
        } else {
          console.warn(`Failed to convert regex match positions ${stringFrom}-${stringTo} to ProseMirror positions`);
        }
      }
      
      break; // Only process first normalized match to avoid duplicates
    }
  }
  
  console.log(`ProseMirror search found ${matches.length} matches`);
  return matches;
}

/**
 * Find cross-node text matches by building a text map of the document
 */
function findCrossNodeMatches(
  doc: ProseMirrorNode,
  searchText: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    segmentId?: string;
  } = {}
): TextMatch[] {
  const { caseSensitive = false, wholeWord = false, segmentId } = options;
  
  // Build a map of document text with position information
  interface TextNode {
    text: string;
    from: number;
    to: number;
    nodeType: string;
    speakerId?: string;
    originalText: string; // Keep original text for exact matching
  }
  
  const textNodes: TextNode[] = [];
  let fullText = '';
  
  console.log('Cross-node search for:', JSON.stringify(searchText));
  console.log('Document structure analysis:');
  
  // First, let's understand the document structure
  let totalContentLength = 0;
  doc.descendants((node, pos) => {
    if (node.isText) {
      console.log(`  Text node: pos=${pos}, text="${node.text}", length=${node.text.length}, nodeSize=${node.nodeSize}`);
      totalContentLength += node.text.length;
    } else {
      console.log(`  Non-text node: pos=${pos}, type=${node.type.name}, nodeSize=${node.nodeSize}`);
    }
  });
  console.log(`Total content length: ${totalContentLength}`);
  
  // Reset and build text nodes array
  doc.descendants((node, pos) => {
    // If segmentId is specified, only search within that speaker segment
    if (segmentId && node.type.name === 'speaker' && node.attrs.id !== segmentId) {
      return false; // Skip this branch
    }
    
    if (node.isText && node.text) {
      // Find parent speaker node if exists
      let speakerId: string | undefined;
      doc.nodesBetween(pos, pos, (n, p) => {
        if (n.type.name === 'speaker') {
          speakerId = n.attrs.id;
          return false;
        }
      });
      
      const textLength = node.text.length;
      // For text nodes, the actual text content position is pos (not pos + 1)
      // because doc.descendants already gives us the content position for text nodes
      textNodes.push({
        text: node.text,
        originalText: node.text,
        from: pos,
        to: pos + textLength,
        nodeType: node.type.name,
        speakerId
      });
      fullText += node.text;
      
      console.log(`Text node at pos ${pos}-${pos + textLength}: "${node.text}" (textLength: ${textLength}, nodeSize: ${node.nodeSize})`);
    }
  });
  
  console.log('Full document text:', JSON.stringify(fullText));
  console.log('Total text nodes:', textNodes.length);
  
  // Try direct text matching first (without normalization)
  const searchLower = caseSensitive ? searchText : searchText.toLowerCase();
  const fullTextLower = caseSensitive ? fullText : fullText.toLowerCase();
  
  const matches: TextMatch[] = [];
  let searchIndex = 0;
  
  while (searchIndex < fullTextLower.length) {
    const matchIndex = fullTextLower.indexOf(searchLower, searchIndex);
    if (matchIndex === -1) break;
    
    console.log(`Found match at fullText position ${matchIndex}: "${fullText.substring(matchIndex, matchIndex + searchText.length)}"`);
    
    // Check for whole word match if required
    if (wholeWord) {
      const beforeChar = matchIndex > 0 ? fullTextLower[matchIndex - 1] : ' ';
      const afterChar = matchIndex + searchLower.length < fullTextLower.length 
        ? fullTextLower[matchIndex + searchLower.length] 
        : ' ';
      
      if (/\w/.test(beforeChar) || /\w/.test(afterChar)) {
        searchIndex = matchIndex + 1;
        continue;
      }
    }
    
    // Find which text nodes this match spans
    let currentPos = 0;
    let startNode: TextNode | null = null;
    let endNode: TextNode | null = null;
    let matchFrom = -1;
    let matchTo = -1;
    
    for (let i = 0; i < textNodes.length; i++) {
      const textNode = textNodes[i];
      const nodeStart = currentPos;
      const nodeEnd = currentPos + textNode.text.length;
      
      console.log(`Node ${i}: pos ${nodeStart}-${nodeEnd} ("${textNode.text}") ProseMirror ${textNode.from}-${textNode.to}`);
      
      // Check if match starts in this node
      if (matchIndex >= nodeStart && matchIndex < nodeEnd && !startNode) {
        startNode = textNode;
        const offsetInNode = matchIndex - nodeStart;
        matchFrom = textNode.from + offsetInNode;
        console.log(`Match starts in node ${i} at offset ${offsetInNode}, ProseMirror pos ${matchFrom}`);
      }
      
      // Check if match ends in this node (inclusive end check)
      const matchEnd = matchIndex + searchText.length;
      if (matchEnd > nodeStart && matchEnd <= nodeEnd && !endNode) {
        endNode = textNode;
        const offsetInNode = matchEnd - nodeStart;
        matchTo = textNode.from + offsetInNode;
        console.log(`Match ends in node ${i} at offset ${offsetInNode}, ProseMirror pos ${matchTo}`);
      }
      
      // Special case: if this is a single character match at the exact end of a node
      if (matchEnd === nodeEnd && searchText.length === 1 && !endNode) {
        endNode = textNode;
        matchTo = textNode.to;
        console.log(`Single char match at node boundary, using node.to=${matchTo}`);
      }
      
      currentPos += textNode.text.length;
      
      if (startNode && endNode) break;
    }
    
    console.log(`Position mapping result: startNode=${!!startNode}, endNode=${!!endNode}, matchFrom=${matchFrom}, matchTo=${matchTo}`);
    
    if (startNode && endNode && matchFrom !== -1 && matchTo !== -1) {
      // Extract the matched text from the original document
      const matchedText = fullText.substring(matchIndex, matchIndex + searchText.length);
      
      // Get context (50 chars before and after)
      const contextStart = Math.max(0, matchIndex - 50);
      const contextEnd = Math.min(fullText.length, matchIndex + searchText.length + 50);
      const context = fullText.substring(contextStart, contextEnd);
      
      console.log(`Successfully created match: from=${matchFrom}, to=${matchTo}, text="${matchedText}"`);
      
      // Validate the match by checking what's actually at those positions in the document
      try {
        const docText = doc.textBetween(matchFrom, matchTo);
        console.log(`Validation: document text at ${matchFrom}-${matchTo}: "${docText}"`);
        if (docText !== matchedText) {
          console.warn(`Position validation failed! Expected "${matchedText}", got "${docText}"`);
        }
      } catch (error) {
        console.error(`Position validation error:`, error);
      }
      
      matches.push({
        from: matchFrom,
        to: matchTo,
        text: matchedText,
        context,
        nodeType: startNode.nodeType,
        speakerId: startNode.speakerId,
      });
    } else {
      console.log(`Failed to map match to ProseMirror positions:`);
      console.log(`  startNode=${!!startNode} (${startNode ? `pos ${startNode.from}-${startNode.to}` : 'none'})`);
      console.log(`  endNode=${!!endNode} (${endNode ? `pos ${endNode.from}-${endNode.to}` : 'none'})`);
      console.log(`  matchFrom=${matchFrom}, matchTo=${matchTo}`);
      console.log(`  searchText length=${searchText.length}, match position=${matchIndex}-${matchIndex + searchText.length}`);
    }
    
    searchIndex = matchIndex + searchText.length;
  }
  
  console.log(`Cross-node search found ${matches.length} matches`);
  return matches;
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
  
  // Normalize whitespace in search text (replace multiple spaces with single space)
  const normalizedSearchText = searchText.replace(/\s+/g, ' ').trim();
  const normalizedSearch = caseSensitive ? normalizedSearchText : normalizedSearchText.toLowerCase();

  // Debug: collect all text content to help with troubleshooting
  let allDocumentText = '';
  doc.descendants((node) => {
    if (node.isText && node.text) {
      allDocumentText += node.text;
    }
  });
  
  // First try searching within individual nodes
  doc.descendants((node, pos) => {
    // If segmentId is specified, only search within that speaker segment
    if (segmentId && node.type.name === 'speaker' && node.attrs.id !== segmentId) {
      return false; // Skip this branch
    }
    
    if (node.isText && node.text) {
      // Normalize whitespace in the document text as well
      const normalizedNodeText = node.text.replace(/\s+/g, ' ').trim();
      const nodeText = caseSensitive ? normalizedNodeText : normalizedNodeText.toLowerCase();
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
        
        // Map the position back to the original text
        // Since we're working with normalized text, we need to find the actual position in the original
        const originalMatchPos = findOriginalPosition(node.text, normalizedNodeText, matchIndex);
        const originalMatchEnd = findOriginalPosition(node.text, normalizedNodeText, matchIndex + normalizedSearch.length);
        
        const from = pos + originalMatchPos;
        const to = pos + originalMatchEnd;
        
        // Get context (50 chars before and after) using original text positions
        const contextStart = Math.max(0, originalMatchPos - 50);
        const contextEnd = Math.min(node.text.length, originalMatchEnd + 50);
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
          text: node.text.substring(originalMatchPos, originalMatchEnd),
          context,
          nodeType: node.type.name,
          speakerId,
        });
        
        searchIndex = matchIndex + normalizedSearch.length;
      }
    }
  });
  
  // If no matches found in individual nodes, try cross-node search
  if (matches.length === 0) {
    const normalizedDocText = allDocumentText.replace(/\s+/g, ' ').trim();
    const docTextForSearch = caseSensitive ? normalizedDocText : normalizedDocText.toLowerCase();
    
    if (docTextForSearch.includes(normalizedSearch)) {
      console.log('Text found in cross-node search, attempting cross-node matching');
      console.log('Search text:', JSON.stringify(normalizedSearch));
      
      // Try simplified cross-node matching using ProseMirror's built-in search
      const simplifiedMatches = findTextUsingProseMirrorSearch(doc, searchText, options);
      if (simplifiedMatches.length > 0) {
        console.log(`Found ${simplifiedMatches.length} matches using ProseMirror search`);
        matches.push(...simplifiedMatches);
      } else {
        // Fallback to manual cross-node matching
        const crossNodeMatches = findCrossNodeMatches(doc, normalizedSearchText, options);
        if (crossNodeMatches.length > 0) {
          console.log(`Found ${crossNodeMatches.length} cross-node matches`);
          matches.push(...crossNodeMatches);
        } else {
          console.log('Cross-node matching failed - text may be in non-text nodes or spans complex structure');
        }
      }
    } else {
      // Enhanced debugging
      console.log('Text not found anywhere in document');
      console.log('Normalized search:', JSON.stringify(normalizedSearch));
      console.log('Full document text (first 500 chars):', JSON.stringify(normalizedDocText.substring(0, 500)));
      
      // Check for partial matches
      const words = normalizedSearch.split(' ');
      const foundWords = words.filter(word => docTextForSearch.includes(word.toLowerCase()));
      if (foundWords.length > 0) {
        console.log('Partial match - found words:', foundWords);
        console.log('Missing words:', words.filter(word => !docTextForSearch.includes(word.toLowerCase())));
      }
    }
  }
  
  return matches;
}

/**
 * Apply text replacement at a specific position with cross-node support
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
      // Check if replacement spans multiple nodes
      let nodeCount = 0;
      state.doc.nodesBetween(from, to, (node: any) => {
        if (node.isText) {
          nodeCount++;
        }
      });
      
      const spansMultipleNodes = nodeCount > 1;
      
      if (spansMultipleNodes) {
        // For cross-node replacement: delete range and insert new text
        const $from = state.doc.resolve(from);
        const marks = preserveMarks ? $from.marks() : null;
        
        // Delete the range first
        tr.delete(from, to);
        
        // Insert replacement text
        const textNode = state.schema.text(replacement, marks);
        tr.insert(from, textNode);
        
        console.log(`Applied cross-node text replacement: ${nodeCount} nodes replaced`);
      } else {
        // Single node replacement (original logic)
        let marks = null;
        if (preserveMarks) {
          const $from = state.doc.resolve(from);
          marks = $from.marks();
        }
        
        tr.replaceWith(from, to, state.schema.text(replacement, marks));
      }
      
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