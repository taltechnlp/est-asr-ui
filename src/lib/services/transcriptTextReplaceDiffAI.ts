import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { v4 as uuidv4 } from 'uuid';

export interface DiffCreationOptions {
  changeType?: string;
  confidence?: number;
  context?: string;
  validateText?: boolean;
  caseSensitive?: boolean;
}

export interface DiffCreationResult {
  success: boolean;
  diffId?: string;
  position?: number;
  error?: string;
}

/**
 * Create a diff node at a specific position in the document (for Word nodes)
 * This is simpler than the mark-based approach since we're dealing with nodes
 */
export function createDiffAtPosition(
  editor: Editor,
  from: number,
  to: number,
  originalText: string,
  suggestedText: string,
  options: DiffCreationOptions = {}
): DiffCreationResult {
  const { changeType = 'text_replacement', confidence = 0.5, context = '', validateText = false } = options;
  
  try {
    const state = editor.state;
    const doc = state.doc;
    
    // Validate positions
    if (from < 0 || to > doc.content.size || from >= to) {
      return {
        success: false,
        error: `Invalid positions: from=${from}, to=${to}, docSize=${doc.content.size}`
      };
    }
    
    // If validation is requested, check the text at the position
    if (validateText) {
      const actualText = doc.textBetween(from, to);
      if (actualText !== originalText) {
        return {
          success: false,
          error: `Text mismatch at position. Expected: "${originalText}", Found: "${actualText}"`
        };
      }
    }
    
    // Generate unique ID for the diff
    const diffId = uuidv4();
    
    // Create the diff node
    const diffNode = editor.schema.nodes.diff.create({
      id: diffId,
      originalText,
      suggestedText,
      changeType,
      confidence,
      context
    });
    
    // Replace the text with the diff node
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, diffNode.toJSON())
      .run();
    
    return {
      success: true,
      diffId,
      position: from
    };
  } catch (error) {
    console.error('Error creating diff at position:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Find text in Word nodes and create a diff
 * This is simpler with Word nodes since we can easily traverse them
 */
export function findAndCreateDiff(
  editor: Editor,
  searchText: string,
  suggestedText: string,
  options: DiffCreationOptions = {}
): DiffCreationResult {
  const { caseSensitive = false } = options;
  
  try {
    const state = editor.state;
    const doc = state.doc;
    
    // Normalize search text for comparison
    const normalizedSearch = caseSensitive ? searchText : searchText.toLowerCase();
    
    let found = false;
    let diffResult: DiffCreationResult = { success: false, error: 'Text not found' };
    
    // First, try to find the text using textBetween which handles node boundaries better
    const fullText = doc.textBetween(0, doc.content.size, ' ', ' ');
    const normalizedFull = caseSensitive ? fullText : fullText.toLowerCase();
    let searchIndex = normalizedFull.indexOf(normalizedSearch);
    
    if (searchIndex !== -1) {
      // Found the text in the document, now find the exact position
      let currentPos = 0;
      let charCount = 0;
      
      doc.nodesBetween(0, doc.content.size, (node, pos) => {
        if (found) return false;
        
        const nodeSize = node.isText ? node.text!.length : node.nodeSize;
        
        // Check if our target position is within this node's range
        if (charCount <= searchIndex && searchIndex < charCount + nodeSize) {
          // Calculate the exact position
          const from = pos + (searchIndex - charCount);
          const to = from + searchText.length;
          
          // Verify the text at this position
          try {
            const actualText = doc.textBetween(from, Math.min(to, doc.content.size), '', '');
            const normalizedActual = caseSensitive ? actualText : actualText.toLowerCase();
            
            if (normalizedActual === normalizedSearch) {
              // Create diff at this position
              diffResult = createDiffAtPosition(
                editor,
                from,
                to,
                searchText,
                suggestedText,
                options
              );
              found = true;
              return false;
            }
          } catch (e) {
            console.warn('Position verification failed:', e);
          }
        }
        
        // Update character count
        if (node.isText) {
          charCount += node.text!.length;
        } else if (node.isLeaf) {
          charCount += node.nodeSize;
        }
        
        return true;
      });
    }
    
    // If still not found, try a more flexible search that handles Word nodes specifically
    if (!found) {
      console.log(`Text search failed for: "${searchText}". Trying flexible search...`);
      
      // Build a map of text positions
      let textMap = '';
      let positionMap: { start: number; end: number; docPos: number }[] = [];
      
      doc.nodesBetween(0, doc.content.size, (node, pos) => {
        if (node.type.name === 'wordNode') {
          const wordText = node.textContent;
          const startIndex = textMap.length;
          textMap += wordText;
          positionMap.push({ start: startIndex, end: startIndex + wordText.length, docPos: pos });
        } else if (node.isText && !node.marks.length) {
          // Plain text (spaces between words)
          const startIndex = textMap.length;
          textMap += node.text || '';
          positionMap.push({ start: startIndex, end: startIndex + (node.text?.length || 0), docPos: pos });
        }
      });
      
      const normalizedMap = caseSensitive ? textMap : textMap.toLowerCase();
      searchIndex = normalizedMap.indexOf(normalizedSearch);
      
      if (searchIndex !== -1) {
        // Find the document positions that correspond to this text range
        const searchEnd = searchIndex + searchText.length;
        
        // Find the first position entry that contains our start
        const startEntry = positionMap.find(entry => entry.start <= searchIndex && searchIndex < entry.end);
        // Find the last position entry that contains our end
        const endEntry = positionMap.find(entry => entry.start < searchEnd && searchEnd <= entry.end);
        
        if (startEntry && endEntry) {
          const from = startEntry.docPos + (searchIndex - startEntry.start);
          const to = endEntry.docPos + (searchEnd - endEntry.start);
          
          diffResult = createDiffAtPosition(
            editor,
            from,
            to,
            searchText,
            suggestedText,
            options
          );
          found = true;
        }
      }
    }
    
    if (!found) {
      console.warn(`Could not find text: "${searchText}" in document`);
      // Log some context to help debug
      const preview = doc.textBetween(0, Math.min(200, doc.content.size), ' ', ' ');
      console.log(`Document preview: "${preview}..."`);
    }
    
    return diffResult;
  } catch (error) {
    console.error('Error finding and creating diff:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Replace Word nodes with plain text (for applying accepted diffs)
 * This is useful when converting Word nodes back to plain text
 */
export function replaceWordNodesWithText(
  editor: Editor,
  from: number,
  to: number,
  newText: string
): boolean {
  try {
    // Delete the Word nodes and insert plain text
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, newText)
      .run();
    
    return true;
  } catch (error) {
    console.error('Error replacing Word nodes with text:', error);
    return false;
  }
}

/**
 * Convert plain text to Word nodes
 * Useful for maintaining the Word node structure after replacements
 */
export function convertTextToWordNodes(
  editor: Editor,
  from: number,
  to: number
): boolean {
  try {
    const text = editor.state.doc.textBetween(from, to);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Create Word nodes for each word
    const wordNodes = words.map((word, index) => ({
      type: 'wordNode',
      attrs: {
        id: uuidv4().substring(36 - 12),
        lang: 'et'
      },
      content: [{ type: 'text', text: word }]
    }));
    
    // Add space text nodes between words
    const contentWithSpaces = [];
    wordNodes.forEach((node, index) => {
      contentWithSpaces.push(node);
      if (index < wordNodes.length - 1) {
        contentWithSpaces.push({ type: 'text', text: ' ' });
      }
    });
    
    // Replace the text with Word nodes
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, contentWithSpaces)
      .run();
    
    return true;
  } catch (error) {
    console.error('Error converting text to Word nodes:', error);
    return false;
  }
}