import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface TextMatch {
  from: number;
  to: number;
  text: string;
}

export interface ReplacementResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  replacedAt?: number;
}

/**
 * Simple, reliable text search that actually works
 * Uses ProseMirror's textBetween to get text and find matches
 */
export function findTextSimple(
  doc: ProseMirrorNode,
  searchText: string,
  options: {
    caseSensitive?: boolean;
    segmentId?: string;
  } = {}
): TextMatch[] {
  const { caseSensitive = false } = options;
  const matches: TextMatch[] = [];
  
  console.log('\n=== Simple Text Search ===');
  console.log('Searching for:', JSON.stringify(searchText));
  
  // Get the full document text using textBetween
  // This gives us the actual text as it appears
  const fullText = doc.textBetween(0, doc.content.size, ' ');
  
  console.log('Document text length:', fullText.length);
  console.log('First 200 chars:', JSON.stringify(fullText.substring(0, 200)));
  
  // Prepare search
  const searchFor = caseSensitive ? searchText : searchText.toLowerCase();
  const searchIn = caseSensitive ? fullText : fullText.toLowerCase();
  
  // Find all occurrences
  let searchIndex = 0;
  while (searchIndex < searchIn.length) {
    const matchIndex = searchIn.indexOf(searchFor, searchIndex);
    if (matchIndex === -1) break;
    
    console.log(`Found match at string position ${matchIndex}`);
    
    // Now map this string position to a document position
    // We need to walk through the document counting characters
    let charCount = 0;
    let docPos = 0;
    let fromPos = -1;
    let toPos = -1;
    
    doc.descendants((node, pos) => {
      // Skip if we already found both positions
      if (fromPos !== -1 && toPos !== -1) return false;
      
      if (node.isText && node.text) {
        const nodeStart = charCount;
        const nodeEnd = charCount + node.text.length;
        
        // Check if match starts in this node
        if (fromPos === -1 && matchIndex >= nodeStart && matchIndex < nodeEnd) {
          fromPos = pos + (matchIndex - nodeStart);
          console.log(`  Match starts at doc position ${fromPos}`);
        }
        
        // Check if match ends in this node
        const matchEnd = matchIndex + searchText.length;
        if (toPos === -1 && matchEnd > nodeStart && matchEnd <= nodeEnd) {
          toPos = pos + (matchEnd - nodeStart);
          console.log(`  Match ends at doc position ${toPos}`);
        }
        
        charCount += node.text.length;
      } else if (node.isBlock && charCount > 0) {
        // Add space for block boundaries (this is what textBetween does)
        charCount += 1;
      }
    });
    
    if (fromPos !== -1 && toPos !== -1) {
      // Verify the match
      const actualText = doc.textBetween(fromPos, toPos);
      console.log(`  Verification: doc.textBetween(${fromPos}, ${toPos}) = "${actualText}"`);
      
      matches.push({
        from: fromPos,
        to: toPos,
        text: actualText
      });
      
      console.log(`  ✓ Added match ${matches.length}`);
    } else {
      console.log(`  ⚠️ Could not map string position to doc position`);
    }
    
    searchIndex = matchIndex + searchText.length;
  }
  
  console.log(`Found ${matches.length} matches total\n`);
  return matches;
}

/**
 * Apply text replacement at specific positions
 */
export function applyTextReplacement(
  editor: Editor,
  from: number,
  to: number,
  replacement: string,
  preserveMarks: boolean = true
): boolean {
  try {
    return editor.chain().focus().command(({ tr, state }) => {
      // Get marks from the first position if we need to preserve them
      let marks = null;
      if (preserveMarks) {
        const $from = state.doc.resolve(from);
        marks = $from.marks();
      }
      
      // Create the replacement text node with marks
      const textNode = state.schema.text(replacement, marks);
      
      // Replace the range with the new text
      tr.replaceWith(from, to, textNode);
      
      console.log(`Applied replacement at ${from}-${to}: "${replacement}"`);
      return true;
    }).run();
  } catch (error) {
    console.error('Failed to apply text replacement:', error);
    return false;
  }
}

/**
 * Main function to find and replace text in the document
 */
export function findAndReplaceTextSimple(
  editor: Editor,
  searchText: string,
  replacementText: string,
  options: {
    caseSensitive?: boolean;
    segmentId?: string;
  } = {}
): ReplacementResult {
  const { state } = editor;
  const { doc } = state;
  
  // Find matches using the simple approach
  const matches = findTextSimple(doc, searchText, options);
  
  if (matches.length === 0) {
    // Build helpful error message
    let errorMsg = `Text "${searchText}" not found in document.`;
    
    // Check what text exists for debugging
    const fullText = doc.textBetween(0, doc.content.size, ' ');
    const words = searchText.split(/\s+/);
    const foundWords = words.filter(w => 
      fullText.toLowerCase().includes(w.toLowerCase())
    );
    
    if (foundWords.length > 0) {
      errorMsg += ` Found ${foundWords.length}/${words.length} words: [${foundWords.join(', ')}].`;
      const missingWords = words.filter(w => 
        !fullText.toLowerCase().includes(w.toLowerCase())
      );
      if (missingWords.length > 0) {
        errorMsg += ` Missing: [${missingWords.join(', ')}].`;
      }
    }
    
    // Add sample of document text for debugging
    console.log('Search failed. Document sample:', JSON.stringify(fullText.substring(0, 500)));
    
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
  
  // Apply the replacement
  const match = matches[0];
  const success = applyTextReplacement(editor, match.from, match.to, replacementText);
  
  return {
    success,
    replacedAt: match.from,
    error: success ? undefined : 'Failed to apply replacement'
  };
}