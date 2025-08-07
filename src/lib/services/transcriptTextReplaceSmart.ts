import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface TextMatch {
  from: number;
  to: number;
  text: string;
  isPartial?: boolean;
}

export interface SmartSearchResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  replacedAt?: number;
}

/**
 * Smart text search that handles common transcription issues:
 * - Leading/trailing punctuation differences
 * - Whitespace variations
 * - Partial phrase matching
 */
export function findTextSmart(
  doc: ProseMirrorNode,
  searchText: string,
  options: {
    caseSensitive?: boolean;
    allowPartialMatch?: boolean;
  } = {}
): TextMatch[] {
  const { caseSensitive = false, allowPartialMatch = true } = options;
  const matches: TextMatch[] = [];
  
  console.log('\n=== Smart Text Search ===');
  console.log('Searching for:', JSON.stringify(searchText));
  
  // Get the full document text
  const fullText = doc.textBetween(0, doc.content.size, ' ');
  const searchLower = caseSensitive ? searchText : searchText.toLowerCase();
  const docLower = caseSensitive ? fullText : fullText.toLowerCase();
  
  // Strategy 1: Try exact match first
  let searchIndex = docLower.indexOf(searchLower);
  if (searchIndex !== -1) {
    console.log('Found exact match at position', searchIndex);
    const match = mapStringPositionToDoc(doc, searchIndex, searchIndex + searchText.length);
    if (match) {
      matches.push(match);
    }
  }
  
  // Strategy 2: Try without leading/trailing punctuation
  if (matches.length === 0 && allowPartialMatch) {
    // Remove leading punctuation/whitespace from search
    const trimmedSearch = searchText.replace(/^[,.\s;:!?]+/, '').replace(/[,.\s;:!?]+$/, '');
    const trimmedLower = caseSensitive ? trimmedSearch : trimmedSearch.toLowerCase();
    
    console.log('Trying without punctuation:', JSON.stringify(trimmedSearch));
    
    // Look for the trimmed version
    searchIndex = 0;
    while (searchIndex < docLower.length) {
      searchIndex = docLower.indexOf(trimmedLower, searchIndex);
      if (searchIndex === -1) break;
      
      // Found a match - now find the actual boundaries including any punctuation
      let startPos = searchIndex;
      let endPos = searchIndex + trimmedSearch.length;
      
      // Extend start backward to include punctuation if the original had it
      if (searchText.startsWith(',') || searchText.startsWith('.')) {
        // Check if there's punctuation before our match
        if (startPos > 0 && /[,.]/.test(fullText[startPos - 1])) {
          startPos--;
          // Skip any whitespace after punctuation
          while (startPos > 0 && /\s/.test(fullText[startPos - 1])) {
            startPos--;
          }
        }
      }
      
      // Extend end forward to include punctuation if the original had it  
      if (searchText.endsWith('.') || searchText.endsWith(',')) {
        // Check if there's punctuation after our match
        if (endPos < fullText.length && /[,.]/.test(fullText[endPos])) {
          endPos++;
        }
      }
      
      console.log(`Found partial match at ${startPos}-${endPos}`);
      const match = mapStringPositionToDoc(doc, startPos, endPos);
      if (match) {
        match.isPartial = true;
        matches.push(match);
      }
      
      searchIndex = endPos;
    }
  }
  
  // Strategy 3: Try finding the phrase even with different punctuation context
  if (matches.length === 0 && allowPartialMatch) {
    // Create a flexible pattern that allows punctuation before/after
    const words = searchText.trim().split(/\s+/);
    const coreWords = words.filter(w => !/^[,.\s;:!?]+$/.test(w)); // Remove pure punctuation
    
    if (coreWords.length > 0) {
      // Build pattern: optional punctuation, then our words with flexible spacing
      const escapedWords = coreWords.map(word => 
        word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[,.\s;:!?]+$/, '') // Remove trailing punct from words
      );
      
      // Allow optional leading punctuation/comma
      const pattern = `(?:[,.]\\s*)?${escapedWords.join('\\s+')}(?:\\s*[,.])?`;
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      
      console.log('Flexible pattern:', pattern);
      
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        
        console.log(`Found flexible match: "${match[0]}" at ${matchStart}-${matchEnd}`);
        
        const docMatch = mapStringPositionToDoc(doc, matchStart, matchEnd);
        if (docMatch) {
          docMatch.isPartial = true;
          matches.push(docMatch);
        }
      }
    }
  }
  
  console.log(`Smart search found ${matches.length} matches\n`);
  return matches;
}

/**
 * Map string positions to document node positions
 */
function mapStringPositionToDoc(
  doc: ProseMirrorNode,
  stringStart: number,
  stringEnd: number
): TextMatch | null {
  let stringPos = 0;
  let fromPos = -1;
  let toPos = -1;
  
  doc.descendants((node, pos) => {
    if (fromPos !== -1 && toPos !== -1) return false;
    
    if (node.isText && node.text) {
      const nodeEnd = stringPos + node.text.length;
      
      // Check if match starts in this node
      if (fromPos === -1 && stringStart >= stringPos && stringStart < nodeEnd) {
        fromPos = pos + (stringStart - stringPos);
      }
      
      // Check if match ends in this node
      if (stringEnd > stringPos && stringEnd <= nodeEnd) {
        toPos = pos + (stringEnd - stringPos);
        return false; // Stop searching
      }
      
      stringPos = nodeEnd;
    } else if (node.isBlock && stringPos > 0) {
      // Account for space added between blocks
      stringPos += 1;
    }
  });
  
  if (fromPos !== -1 && toPos !== -1) {
    const actualText = doc.textBetween(fromPos, toPos);
    return {
      from: fromPos,
      to: toPos,
      text: actualText
    };
  }
  
  return null;
}

/**
 * Create diff with smart text matching
 */
export function findAndCreateDiffSmart(
  editor: Editor,
  searchText: string,
  suggestedText: string,
  options: {
    caseSensitive?: boolean;
    changeType?: string;
    confidence?: number;
    context?: string;
    allowPartialMatch?: boolean;
  } = {}
): SmartSearchResult {
  const { state } = editor;
  const { doc } = state;
  const { changeType = 'text_replacement', confidence = 0.5, context, allowPartialMatch = true } = options;
  
  // Try smart search
  const matches = findTextSmart(doc, searchText, { caseSensitive: options.caseSensitive, allowPartialMatch });
  
  if (matches.length === 0) {
    // Provide helpful error message
    const fullText = doc.textBetween(0, doc.content.size, ' ');
    const searchCore = searchText.replace(/^[,.\s;:!?]+/, '').replace(/[,.\s;:!?]+$/, '');
    const coreInDoc = fullText.toLowerCase().includes(searchCore.toLowerCase());
    
    let errorMsg = `Text "${searchText}" not found.`;
    if (coreInDoc) {
      errorMsg += ` The core phrase "${searchCore}" exists but with different punctuation/context.`;
      
      // Try to find and show the actual context
      const idx = fullText.toLowerCase().indexOf(searchCore.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 10);
        const end = Math.min(fullText.length, idx + searchCore.length + 10);
        const context = fullText.substring(start, end);
        errorMsg += ` Found as: "...${context}..."`;
      }
    }
    
    return {
      success: false,
      error: errorMsg,
      matchCount: 0
    };
  }
  
  if (matches.length > 1) {
    return {
      success: false,
      error: `Multiple matches found (${matches.length}). Please be more specific.`,
      matchCount: matches.length
    };
  }
  
  // Create diff node
  const match = matches[0];
  
  try {
    const diffId = `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const success = editor.chain().focus().command(({ tr, state }) => {
      if (!state.schema.nodes.diff) {
        console.error('Diff node type not registered');
        return false;
      }
      
      // Note if this was a partial match
      const note = match.isPartial ? ' (partial match with punctuation differences)' : '';
      
      const diffNode = state.schema.nodes.diff.create({
        id: diffId,
        originalText: match.text,
        suggestedText,
        changeType,
        confidence,
        context: (context || '') + note,
        from: match.from,
        to: match.to
      });
      
      tr.replaceWith(match.from, match.to, diffNode);
      console.log(`Created diff node${note} at ${match.from}-${match.to}`);
      
      return true;
    }).run();
    
    return {
      success,
      replacedAt: match.from,
      matchCount: 1
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create diff node'
    };
  }
}