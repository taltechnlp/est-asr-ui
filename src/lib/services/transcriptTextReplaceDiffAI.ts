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
    
    // Search through the document for Word nodes
    doc.descendants((node, pos) => {
      if (found) return false; // Stop if already found
      
      // Skip non-text content
      if (!node.isText && node.type.name !== 'wordNode') return true;
      
      // For Word nodes, get the text content
      let nodeText = '';
      let nodeStart = pos;
      
      if (node.type.name === 'wordNode') {
        // Extract text from Word node content
        node.content.forEach((child) => {
          if (child.isText) {
            nodeText += child.text;
          }
        });
      } else if (node.isText) {
        nodeText = node.text || '';
      }
      
      // Check if this node contains our search text
      const normalizedNode = caseSensitive ? nodeText : nodeText.toLowerCase();
      const searchIndex = normalizedNode.indexOf(normalizedSearch);
      
      if (searchIndex !== -1) {
        // Found the text
        const from = nodeStart + searchIndex;
        const to = from + searchText.length;
        
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
        return false; // Stop searching
      }
      
      return true; // Continue searching
    });
    
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