import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { findChildren, findParentNode } from 'prosemirror-utils';
import type { Selection } from 'prosemirror-state';

export interface TextMatch {
  from: number;
  to: number;
  text: string;
  nodes: Array<{ node: ProseMirrorNode; pos: number }>;
}

export interface ReplacementResult {
  success: boolean;
  error?: string;
  matchCount?: number;
  replacedAt?: number;
}

/**
 * Extracts text from a node, handling both text content and marked text
 */
function getNodeText(node: ProseMirrorNode): string {
  if (node.isText) {
    return node.text || '';
  }
  return '';
}

/**
 * Normalize a word for comparison by removing trailing punctuation and whitespace
 */
function normalizeWord(word: string): string {
  // Remove trailing punctuation and whitespace but keep internal punctuation
  return word.replace(/[\s,;.!?:]+$/, '').replace(/^[\s,;.!?:]+/, '');
}

/**
 * Check if two words match, ignoring trailing punctuation
 */
function wordsMatch(word1: string, word2: string, caseSensitive: boolean = false): boolean {
  const normalized1 = normalizeWord(word1);
  const normalized2 = normalizeWord(word2);
  
  if (!caseSensitive) {
    return normalized1.toLowerCase() === normalized2.toLowerCase();
  }
  return normalized1 === normalized2;
}

/**
 * Find text using prosemirror-utils findChildren approach
 * This is more robust as it properly tracks node positions
 */
export function findTextUsingProseMirrorUtils(
  doc: ProseMirrorNode,
  searchText: string,
  selection?: Selection,
  options: {
    caseSensitive?: boolean;
    segmentId?: string;
  } = {}
): TextMatch[] {
  const { caseSensitive = false, segmentId } = options;
  const matches: TextMatch[] = [];
  
  console.log('\n=== ProseMirror Utils Search ===');
  console.log('Searching for:', JSON.stringify(searchText));
  
  // Split search text into words for matching
  const searchWords = searchText.split(/\s+/).filter(w => w.length > 0);
  const searchLower = caseSensitive ? searchText : searchText.toLowerCase();
  
  // Find all speaker blocks in the document
  const speakerBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];
  
  doc.descendants((node, pos) => {
    if (node.type.name === 'speaker') {
      // If segmentId is specified, only include that speaker
      if (!segmentId || node.attrs.id === segmentId) {
        speakerBlocks.push({ node, pos });
      }
    }
  });
  
  console.log(`Found ${speakerBlocks.length} speaker blocks to search`);
  
  // Search within each speaker block
  for (const speakerBlock of speakerBlocks) {
    const { node: speaker, pos: speakerPos } = speakerBlock;
    
    // Use findChildren to get all text nodes within this speaker block
    // Note: We need to adjust positions - findChildren returns positions relative to parent
    const textNodes = findChildren(
      speaker,
      (node) => node.isText
    );
    
    console.log(`Speaker block at pos ${speakerPos} has ${textNodes.length} text nodes`);
    
    // Build a sequence of words with their positions
    const wordSequence: Array<{
      text: string;
      node: ProseMirrorNode;
      pos: number; // Absolute position in document
      localPos: number; // Position relative to speaker
      wordMark?: any;
    }> = [];
    
    // Build continuous text to see what we're working with
    let continuousText = '';
    
    for (const { node, pos: localPos } of textNodes) {
      const text = getNodeText(node);
      if (text) {
        continuousText += text;
        
        // Check if this text node has a word mark
        const wordMark = node.marks?.find(mark => mark.type.name === 'word');
        
        // Calculate absolute position: speaker pos + 1 (for speaker node opening) + local pos
        const absolutePos = speakerPos + 1 + localPos;
        
        wordSequence.push({
          text,
          node,
          pos: absolutePos,
          localPos,
          wordMark
        });
        
        console.log(`  Text node: "${text}" at absolute pos ${absolutePos}, local pos ${localPos}, has word mark: ${!!wordMark}`);
      }
    }
    
    // Log the continuous text to see what we're searching in
    console.log(`  Continuous text in speaker block: "${continuousText.substring(0, 200)}..."`);
    
    // Check if our search text appears in the continuous text
    const searchInContinuous = continuousText.toLowerCase().includes(searchText.toLowerCase());
    console.log(`  Search text "${searchText}" appears in continuous text: ${searchInContinuous}`);
    
    // If the exact text exists in continuous text, try a direct substring approach
    if (searchInContinuous) {
      const searchLower = searchText.toLowerCase();
      const continuousLower = continuousText.toLowerCase();
      const matchIndex = continuousLower.indexOf(searchLower);
      
      if (matchIndex !== -1) {
        console.log(`  Found exact match at position ${matchIndex} in continuous text`);
        
        // Now we need to map this back to the word sequence
        let charCount = 0;
        let startWordIdx = -1;
        let endWordIdx = -1;
        let startOffset = 0;
        let endOffset = 0;
        
        for (let i = 0; i < wordSequence.length; i++) {
          const wordLen = wordSequence[i].text.length;
          const wordEnd = charCount + wordLen;
          
          // Check if match starts in this word
          if (startWordIdx === -1 && matchIndex >= charCount && matchIndex < wordEnd) {
            startWordIdx = i;
            startOffset = matchIndex - charCount;
            console.log(`    Match starts in word ${i}: "${wordSequence[i].text}" at offset ${startOffset}`);
          }
          
          // Check if match ends in this word
          const matchEnd = matchIndex + searchText.length;
          if (matchEnd > charCount && matchEnd <= wordEnd) {
            endWordIdx = i;
            endOffset = matchEnd - charCount;
            console.log(`    Match ends in word ${i}: "${wordSequence[i].text}" at offset ${endOffset}`);
            break;
          }
          
          charCount = wordEnd;
        }
        
        if (startWordIdx !== -1 && endWordIdx !== -1) {
          console.log(`  ✓ Found exact substring match from word ${startWordIdx} to ${endWordIdx}`);
          
          // Create match using the exact positions
          const firstWord = wordSequence[startWordIdx];
          const lastWord = wordSequence[endWordIdx];
          
          const from = firstWord.pos + startOffset;
          const to = lastWord.pos + endOffset;
          
          // Get the matched words
          const matchedWords = wordSequence.slice(startWordIdx, endWordIdx + 1);
          const matchedText = continuousText.substring(matchIndex, matchIndex + searchText.length);
          
          console.log(`  Match: "${matchedText}" at positions ${from}-${to}`);
          
          matches.push({
            from,
            to,
            text: matchedText,
            nodes: matchedWords.map(w => ({ node: w.node, pos: w.pos }))
          });
          
          continue; // Skip the word-by-word search since we found it
        }
      }
    }
    
    // Now search for consecutive sequences matching our search text
    // We need to be more flexible about matching due to how text might be split
    
    console.log(`  Searching for words: [${searchWords.join(', ')}]`);
    
    // Try to find sequences that match word by word
    for (let i = 0; i < wordSequence.length; i++) {
      let matchedWords = 0;
      let currentIndex = i;
      const matchSequence = [];
      let debugInfo = [];
      
      // Try to match each search word
      for (let wordIdx = 0; wordIdx < searchWords.length; wordIdx++) {
        const searchWord = searchWords[wordIdx];
        if (currentIndex >= wordSequence.length) {
          debugInfo.push(`  Word ${wordIdx} "${searchWord}": Reached end of sequence`);
          break;
        }
        
        let found = false;
        let searchDistance = 0;
        
        // Look at the current position and next few positions for this word
        // Increase search window to handle cases where words might be further apart
        const maxLookAhead = 10; // Increased from 3 to handle larger gaps
        
        for (let j = currentIndex; j < Math.min(currentIndex + maxLookAhead, wordSequence.length); j++) {
          const nodeText = wordSequence[j].text;
          // Since nodes include trailing spaces/punctuation, normalize for comparison
          const nodeWord = normalizeWord(nodeText);
          searchDistance = j - currentIndex;
          
          // Check if this node contains the search word
          if (wordsMatch(nodeWord, searchWord, caseSensitive)) {
            matchSequence.push(wordSequence[j]);
            
            // Log if we had to skip nodes
            if (searchDistance > 0) {
              const skippedNodes = wordSequence.slice(currentIndex, j);
              const skippedText = skippedNodes.map(n => `"${n.text}"`).join(', ');
              debugInfo.push(`  Word ${wordIdx} "${searchWord}": Found at distance ${searchDistance}, skipped: [${skippedText}]`);
              console.log(`    ⚠️ Had to skip ${searchDistance} nodes to match "${searchWord}": [${skippedText}]`);
            } else {
              debugInfo.push(`  Word ${wordIdx} "${searchWord}": Found immediately at index ${j}`);
            }
            
            currentIndex = j + 1;
            matchedWords++;
            found = true;
            console.log(`    Matched word "${searchWord}" with node "${nodeText}" (normalized: "${nodeWord}") at pos ${wordSequence[j].pos}`);
            break;
          }
          
          // Also check if combining this node with the next gives us the word (rare case)
          if (j + 1 < wordSequence.length) {
            const combined = normalizeWord(nodeText + wordSequence[j + 1].text);
            if (wordsMatch(combined, searchWord, caseSensitive)) {
              matchSequence.push(wordSequence[j]);
              matchSequence.push(wordSequence[j + 1]);
              currentIndex = j + 2;
              matchedWords++;
              found = true;
              debugInfo.push(`  Word ${wordIdx} "${searchWord}": Found as combined nodes at index ${j}`);
              console.log(`    Matched word "${searchWord}" with combined nodes at pos ${wordSequence[j].pos}`);
              break;
            }
          }
        }
        
        if (!found) {
          // This word wasn't found within the search window
          debugInfo.push(`  Word ${wordIdx} "${searchWord}": NOT FOUND within ${maxLookAhead} nodes from index ${currentIndex}`);
          
          // Log what we saw instead
          const nearbyNodes = wordSequence.slice(currentIndex, Math.min(currentIndex + 5, wordSequence.length));
          const nearbyText = nearbyNodes.map(n => `"${normalizeWord(n.text)}"`).join(', ');
          console.log(`    ❌ Could not find "${searchWord}" near index ${currentIndex}. Next nodes: [${nearbyText}]`);
          break;
        }
      }
      
      // Check if we found all words
      if (matchedWords === searchWords.length && matchSequence.length > 0) {
        // Check for large gaps between words
        const hasLargeGaps = debugInfo.some(info => info.includes('distance') && parseInt(info.match(/distance (\d+)/)?.[1] || '0') > 2);
        
        if (hasLargeGaps) {
          console.log(`  ⚠️ Found all words but with gaps - accepting as a match anyway`);
          console.log('  Debug info:\n' + debugInfo.join('\n'));
        } else {
          console.log(`  ✓ Found complete consecutive match starting at index ${i}!`);
        }
        
        // Calculate positions from the matched sequence
        const firstWord = matchSequence[0];
        const lastWord = matchSequence[matchSequence.length - 1];
        
        // Important: If there are gaps, we can't use simple from/to positions
        // because that would include intermediate words we don't want to replace
        if (hasLargeGaps) {
          console.log(`  ⚠️ Cannot perform replacement with gaps - would affect intermediate text`);
          // Don't add this as a match since we can't safely replace it
          continue;
        }
        
        const from = firstWord.pos;
        const to = lastWord.pos + lastWord.text.length;
        
        // Get the actual matched text (already includes spaces/punctuation)
        const matchedText = matchSequence.map(w => w.text).join('');
        
        console.log(`  Match: "${matchedText}" at positions ${from}-${to}`);
        
        matches.push({
          from,
          to,
          text: matchedText,
          nodes: matchSequence.map(w => ({ node: w.node, pos: w.pos }))
        });
        
        // Skip past this match for the next search
        i = currentIndex - 1;
      }
    }
  }
  
  // If no matches found and we're debugging, log the full word sequence
  if (matches.length === 0 && speakerBlocks.length > 0) {
    console.log('\n  ⚠️ No matches found. Full word sequence for debugging:');
    speakerBlocks.forEach((speakerBlock, blockIndex) => {
      const { node: speaker, pos: speakerPos } = speakerBlock;
      const textNodes = findChildren(speaker, (node) => node.isText);
      
      console.log(`  Speaker block ${blockIndex}:`);
      textNodes.forEach(({ node, pos: localPos }, index) => {
        const text = getNodeText(node);
        if (text) {
          console.log(`    [${index}] "${text}"`);
        }
      });
    });
    
    // Also log what we were searching for
    console.log(`\n  We were searching for: "${searchText}"`);
    console.log(`  As words: [${searchWords.map(w => `"${w}"`).join(', ')}]`);
  }
  
  console.log(`ProseMirror Utils search found ${matches.length} matches\n`);
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
export function findAndReplaceText(
  editor: Editor,
  searchText: string,
  replacementText: string,
  options: {
    caseSensitive?: boolean;
    segmentId?: string;
  } = {}
): ReplacementResult {
  const { state } = editor;
  const { doc, selection } = state;
  
  // Find matches using the robust prosemirror-utils approach
  const matches = findTextUsingProseMirrorUtils(doc, searchText, selection, options);
  
  if (matches.length === 0) {
    // Build helpful error message
    let errorMsg = `Text "${searchText}" not found in document.`;
    
    // Check what text exists in the document for debugging
    let allText = '';
    let allWords: string[] = [];
    doc.descendants((node) => {
      if (node.isText) {
        allText += node.text;
        allWords.push(node.text.trim());
      }
    });
    
    const words = searchText.split(/\s+/);
    const foundWords = words.filter(w => 
      allText.toLowerCase().includes(w.toLowerCase())
    );
    
    if (foundWords.length > 0) {
      errorMsg += ` Found ${foundWords.length}/${words.length} words: [${foundWords.join(', ')}].`;
      const missingWords = words.filter(w => 
        !allText.toLowerCase().includes(w.toLowerCase())
      );
      if (missingWords.length > 0) {
        errorMsg += ` Missing: [${missingWords.join(', ')}].`;
      } else {
        // All words found but phrase not matching
        errorMsg += ` All words exist but not as a consecutive phrase. `;
        
        // Try to understand why
        console.log('Debug: Looking for word positions in document...');
        const searchWordsLower = words.map(w => w.toLowerCase());
        const wordPositions: { [key: string]: number[] } = {};
        
        // Find positions of each search word
        searchWordsLower.forEach(searchWord => {
          wordPositions[searchWord] = [];
        });
        
        allWords.forEach((word, index) => {
          const normalizedWord = normalizeWord(word).toLowerCase();
          searchWordsLower.forEach(searchWord => {
            if (normalizedWord === searchWord) {
              wordPositions[searchWord].push(index);
            }
          });
        });
        
        // Check if words appear in order but with gaps
        let lastPos = -1;
        let maxGap = 0;
        let inOrder = true;
        
        for (const searchWord of searchWordsLower) {
          const positions = wordPositions[searchWord];
          if (positions.length === 0) {
            inOrder = false;
            break;
          }
          
          // Find the first position after lastPos
          const nextPos = positions.find(p => p > lastPos);
          if (nextPos === undefined) {
            inOrder = false;
            break;
          }
          
          if (lastPos !== -1) {
            const gap = nextPos - lastPos - 1;
            maxGap = Math.max(maxGap, gap);
          }
          
          lastPos = nextPos;
        }
        
        if (inOrder && maxGap > 0) {
          errorMsg += `The words appear in order but with ${maxGap} word(s) between them. `;
          errorMsg += `The transcript may contain extra words or the phrase may span multiple segments.`;
        } else if (!inOrder) {
          errorMsg += `The words don't appear in the expected order in the document.`;
        }
        
        // Log detailed positions
        console.log('Word positions in document:');
        Object.entries(wordPositions).forEach(([word, positions]) => {
          console.log(`  "${word}": positions ${positions.join(', ')}`);
        });
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
  
  // Apply the replacement
  const match = matches[0];
  const success = applyTextReplacement(editor, match.from, match.to, replacementText);
  
  return {
    success,
    replacedAt: match.from,
    error: success ? undefined : 'Failed to apply replacement'
  };
}