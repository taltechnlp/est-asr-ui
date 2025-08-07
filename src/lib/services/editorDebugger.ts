import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface EditorSnapshot {
  timestamp: string;
  fullText: string;
  structure: NodeStructure;
  wordNodes: WordNode[];
  speakerBlocks: SpeakerBlock[];
}

export interface NodeStructure {
  type: string;
  attrs?: any;
  marks?: string[];
  content?: NodeStructure[];
  text?: string;
  position?: number;
}

export interface WordNode {
  text: string;
  position: number;
  marks: string[];
  parent: string;
  parentId?: string;
}

export interface SpeakerBlock {
  id: string;
  position: number;
  text: string;
  wordCount: number;
}

/**
 * Create a detailed snapshot of the editor state for debugging
 */
export function createEditorSnapshot(editor: Editor): EditorSnapshot {
  const doc = editor.state.doc;
  
  return {
    timestamp: new Date().toISOString(),
    fullText: doc.textBetween(0, doc.content.size, ' '),
    structure: documentToStructure(doc),
    wordNodes: extractWordNodes(doc),
    speakerBlocks: extractSpeakerBlocks(doc)
  };
}

/**
 * Convert document to a nested structure for visualization
 */
function documentToStructure(node: ProseMirrorNode, pos: number = 0): NodeStructure {
  const structure: NodeStructure = {
    type: node.type.name,
    position: pos
  };
  
  if (node.attrs && Object.keys(node.attrs).length > 0) {
    structure.attrs = node.attrs;
  }
  
  if (node.marks && node.marks.length > 0) {
    structure.marks = node.marks.map(m => m.type.name);
  }
  
  if (node.isText) {
    structure.text = node.text || '';
  }
  
  if (node.content && node.content.size > 0) {
    structure.content = [];
    let childPos = pos + 1;
    
    node.content.forEach((child) => {
      structure.content!.push(documentToStructure(child, childPos));
      childPos += child.nodeSize;
    });
  }
  
  return structure;
}

/**
 * Extract all word nodes with their positions and context
 */
function extractWordNodes(doc: ProseMirrorNode): WordNode[] {
  const wordNodes: WordNode[] = [];
  let currentSpeaker: { type: string; id?: string } | null = null;
  
  doc.descendants((node, pos, parent) => {
    // Track current speaker context
    if (node.type.name === 'speaker') {
      currentSpeaker = {
        type: 'speaker',
        id: node.attrs.id
      };
    }
    
    // Extract text nodes with word marks
    if (node.isText && node.text) {
      const hasWordMark = node.marks?.some(m => m.type.name === 'word');
      
      wordNodes.push({
        text: node.text,
        position: pos,
        marks: node.marks?.map(m => m.type.name) || [],
        parent: parent?.type.name || 'unknown',
        parentId: currentSpeaker?.id
      });
    }
  });
  
  return wordNodes;
}

/**
 * Extract speaker blocks with their content
 */
function extractSpeakerBlocks(doc: ProseMirrorNode): SpeakerBlock[] {
  const blocks: SpeakerBlock[] = [];
  
  doc.descendants((node, pos) => {
    if (node.type.name === 'speaker') {
      const text = node.textBetween(0, node.content.size, ' ');
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      
      blocks.push({
        id: node.attrs.id || 'unknown',
        position: pos,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        wordCount
      });
    }
  });
  
  return blocks;
}

/**
 * Log a detailed snapshot to console with formatting
 */
export function logEditorSnapshot(editor: Editor, label: string = 'Editor Snapshot') {
  const snapshot = createEditorSnapshot(editor);
  
  console.group(`📸 ${label} - ${snapshot.timestamp}`);
  
  console.group('📄 Document Text');
  console.log('Full text length:', snapshot.fullText.length);
  console.log('First 500 chars:', snapshot.fullText.substring(0, 500));
  console.groupEnd();
  
  console.group('🎙️ Speaker Blocks');
  snapshot.speakerBlocks.forEach(block => {
    console.log(`Speaker ${block.id} at pos ${block.position}:`);
    console.log(`  Words: ${block.wordCount}`);
    console.log(`  Preview: "${block.text}"`);
  });
  console.groupEnd();
  
  console.group('📝 Word Nodes (first 20)');
  snapshot.wordNodes.slice(0, 20).forEach((node, i) => {
    console.log(`[${i}] pos:${node.position} "${node.text}" marks:[${node.marks.join(',')}] parent:${node.parent}${node.parentId ? `(${node.parentId})` : ''}`);
  });
  console.log(`... and ${Math.max(0, snapshot.wordNodes.length - 20)} more`);
  console.groupEnd();
  
  console.group('🌳 Document Structure (simplified)');
  console.log(JSON.stringify(simplifyStructure(snapshot.structure), null, 2));
  console.groupEnd();
  
  console.groupEnd();
  
  return snapshot;
}

/**
 * Simplify structure for logging
 */
function simplifyStructure(structure: NodeStructure, depth: number = 0, maxDepth: number = 3): any {
  if (depth > maxDepth) {
    return { type: structure.type, content: '...' };
  }
  
  const simple: any = {
    type: structure.type,
    pos: structure.position
  };
  
  if (structure.text) {
    simple.text = structure.text.substring(0, 20) + (structure.text.length > 20 ? '...' : '');
  }
  
  if (structure.attrs && Object.keys(structure.attrs).length > 0) {
    simple.attrs = structure.attrs;
  }
  
  if (structure.marks && structure.marks.length > 0) {
    simple.marks = structure.marks;
  }
  
  if (structure.content && structure.content.length > 0) {
    simple.children = structure.content.length;
    if (depth < maxDepth) {
      simple.content = structure.content.slice(0, 3).map(c => simplifyStructure(c, depth + 1, maxDepth));
      if (structure.content.length > 3) {
        simple.content.push({ type: '...', remaining: structure.content.length - 3 });
      }
    }
  }
  
  return simple;
}

/**
 * Search for text in snapshot and return detailed results
 */
export function searchInSnapshot(snapshot: EditorSnapshot, searchText: string): {
  found: boolean;
  exactMatch: boolean;
  locations: Array<{
    position: number;
    context: string;
    inSpeaker?: string;
  }>;
  wordAnalysis: {
    searchWords: string[];
    foundWords: string[];
    missingWords: string[];
    wordPositions: Map<string, number[]>;
  };
} {
  const searchLower = searchText.toLowerCase();
  const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  // Check for exact match
  const exactMatch = snapshot.fullText.toLowerCase().includes(searchLower);
  
  // Find locations
  const locations: Array<{ position: number; context: string; inSpeaker?: string }> = [];
  if (exactMatch) {
    let index = 0;
    while (index < snapshot.fullText.length) {
      const pos = snapshot.fullText.toLowerCase().indexOf(searchLower, index);
      if (pos === -1) break;
      
      const start = Math.max(0, pos - 30);
      const end = Math.min(snapshot.fullText.length, pos + searchText.length + 30);
      const context = snapshot.fullText.substring(start, end);
      
      // Find which speaker block this is in
      let inSpeaker: string | undefined;
      for (const block of snapshot.speakerBlocks) {
        if (pos >= block.position && pos < block.position + block.text.length) {
          inSpeaker = block.id;
          break;
        }
      }
      
      locations.push({
        position: pos,
        context,
        inSpeaker
      });
      
      index = pos + searchText.length;
    }
  }
  
  // Word analysis
  const wordPositions = new Map<string, number[]>();
  searchWords.forEach(word => {
    wordPositions.set(word, []);
    
    snapshot.wordNodes.forEach((node, index) => {
      const nodeText = node.text.toLowerCase().replace(/[.,;:!?]+$/, '').trim();
      if (nodeText === word) {
        wordPositions.get(word)!.push(index);
      }
    });
  });
  
  const foundWords = searchWords.filter(w => wordPositions.get(w)!.length > 0);
  const missingWords = searchWords.filter(w => wordPositions.get(w)!.length === 0);
  
  return {
    found: exactMatch || foundWords.length === searchWords.length,
    exactMatch,
    locations,
    wordAnalysis: {
      searchWords,
      foundWords,
      missingWords,
      wordPositions
    }
  };
}

/**
 * Export snapshot to JSON file for analysis
 */
export function exportSnapshot(snapshot: EditorSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Compare two snapshots to find differences
 */
export function compareSnapshots(before: EditorSnapshot, after: EditorSnapshot): {
  textChanged: boolean;
  structureChanged: boolean;
  differences: string[];
} {
  const differences: string[] = [];
  
  const textChanged = before.fullText !== after.fullText;
  if (textChanged) {
    differences.push(`Text length changed: ${before.fullText.length} -> ${after.fullText.length}`);
  }
  
  const structureChanged = JSON.stringify(before.structure) !== JSON.stringify(after.structure);
  if (structureChanged) {
    differences.push('Document structure changed');
  }
  
  const wordCountBefore = before.wordNodes.length;
  const wordCountAfter = after.wordNodes.length;
  if (wordCountBefore !== wordCountAfter) {
    differences.push(`Word node count changed: ${wordCountBefore} -> ${wordCountAfter}`);
  }
  
  const speakerCountBefore = before.speakerBlocks.length;
  const speakerCountAfter = after.speakerBlocks.length;
  if (speakerCountBefore !== speakerCountAfter) {
    differences.push(`Speaker block count changed: ${speakerCountBefore} -> ${speakerCountAfter}`);
  }
  
  return {
    textChanged,
    structureChanged,
    differences
  };
}