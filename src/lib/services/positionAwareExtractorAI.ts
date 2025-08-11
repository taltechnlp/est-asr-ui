import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * Position-aware document segment with absolute positions
 * Adapted for Word nodes instead of word marks
 */
export interface PositionAwareSegment {
  // Unique identifier for this segment
  id: string;
  
  // Absolute position in the document
  from: number;
  to: number;
  
  // Text content of the segment
  text: string;
  
  // Character offsets within the segment (for LLM to use)
  startOffset: number;
  endOffset: number;
  
  // Node type information
  nodeType: string;
  nodeAttrs?: Record<string, any>;
  
  // Parent context
  parentType?: string;
  parentAttrs?: Record<string, any>;
  
  // Speaker information if in speaker block
  speakerName?: string;
  speakerId?: string;
  
  // Timing information if available (from Word nodes)
  startTime?: number;
  endTime?: number;
  
  // Hierarchical path in document
  path: number[];
}

/**
 * Extract position-aware segments from the editor with Word nodes
 */
export function extractPositionAwareSegments(editor: Editor): PositionAwareSegment[] {
  const doc = editor.state.doc;
  const segments: PositionAwareSegment[] = [];
  let segmentId = 0;
  
  // Track current context
  let currentSpeaker: string | undefined;
  let currentSpeakerId: string | undefined;
  let parentStack: Array<{ type: string; attrs?: Record<string, any> }> = [];
  
  // Traverse document with position tracking
  doc.nodesBetween(0, doc.content.size, (node, pos, parent, index) => {
    // Update parent stack
    if (parent) {
      parentStack = [];
      let currentParent = parent;
      while (currentParent && currentParent !== doc) {
        parentStack.unshift({
          type: currentParent.type.name,
          attrs: currentParent.attrs
        });
        currentParent = currentParent.parent as ProseMirrorNode;
      }
    }
    
    // Track speaker context
    if (node.type.name === 'speaker') {
      currentSpeaker = node.attrs['data-name'] || 'Unknown Speaker';
      currentSpeakerId = node.attrs.id;
    }
    
    // Process Word nodes (not text nodes with marks)
    if (node.type.name === 'wordNode') {
      // Extract timing from Word node attributes
      const startTime = node.attrs.start;
      const endTime = node.attrs.end;
      
      // Get text content from Word node
      let wordText = '';
      node.content.forEach((child) => {
        if (child.isText) {
          wordText += child.text;
        }
      });
      
      const segment: PositionAwareSegment = {
        id: `segment_${segmentId++}`,
        from: pos,
        to: pos + node.nodeSize,
        text: wordText,
        startOffset: 0,
        endOffset: wordText.length,
        nodeType: 'wordNode',
        nodeAttrs: node.attrs,
        parentType: parent?.type.name,
        parentAttrs: parent?.attrs,
        speakerName: currentSpeaker,
        speakerId: currentSpeakerId,
        startTime,
        endTime,
        path: parentStack.map((_, i) => i)
      };
      
      segments.push(segment);
    }
    // Also process plain text nodes (spaces between words)
    else if (node.isText && node.text) {
      const segment: PositionAwareSegment = {
        id: `segment_${segmentId++}`,
        from: pos,
        to: pos + node.nodeSize,
        text: node.text,
        startOffset: 0,
        endOffset: node.text.length,
        nodeType: 'text',
        parentType: parent?.type.name,
        parentAttrs: parent?.attrs,
        speakerName: currentSpeaker,
        speakerId: currentSpeakerId,
        path: parentStack.map((_, i) => i)
      };
      
      segments.push(segment);
    }
    
    return true; // Continue traversing
  });
  
  return segments;
}

/**
 * Extract speaker-level segments (combines Word nodes within speakers)
 */
export function extractSpeakerSegmentsWithPositions(editor: Editor): PositionAwareSegment[] {
  const doc = editor.state.doc;
  const segments: PositionAwareSegment[] = [];
  let segmentId = 0;
  
  // Process each speaker node
  doc.content.forEach((node, offset) => {
    if (node.type.name === 'speaker') {
      const speakerName = node.attrs['data-name'] || 'Unknown Speaker';
      const speakerId = node.attrs.id;
      
      // Collect all text from Word nodes and text nodes
      let fullText = '';
      let firstTime: number | undefined;
      let lastTime: number | undefined;
      
      node.content.forEach((child) => {
        if (child.type.name === 'wordNode') {
          // Get text from Word node
          child.content.forEach((textNode) => {
            if (textNode.isText) {
              fullText += textNode.text;
            }
          });
          
          // Track timing
          if (child.attrs.start !== undefined && (firstTime === undefined || child.attrs.start < firstTime)) {
            firstTime = child.attrs.start;
          }
          if (child.attrs.end !== undefined && (lastTime === undefined || child.attrs.end > lastTime)) {
            lastTime = child.attrs.end;
          }
        } else if (child.isText) {
          // Add space or other text nodes
          fullText += child.text;
        }
      });
      
      const segment: PositionAwareSegment = {
        id: `speaker_${segmentId++}`,
        from: offset,
        to: offset + node.nodeSize,
        text: fullText.trim(),
        startOffset: 0,
        endOffset: fullText.trim().length,
        nodeType: 'speaker',
        nodeAttrs: node.attrs,
        speakerName,
        speakerId,
        startTime: firstTime,
        endTime: lastTime,
        path: [0] // Speaker nodes are at root level
      };
      
      segments.push(segment);
    }
  });
  
  return segments;
}

/**
 * Format segments for LLM consumption
 */
export function formatSegmentsForLLM(segments: PositionAwareSegment[]): string {
  return segments.map(segment => {
    const timing = segment.startTime !== undefined && segment.endTime !== undefined
      ? ` [${segment.startTime.toFixed(2)}s - ${segment.endTime.toFixed(2)}s]`
      : '';
    
    return `[Segment ID: ${segment.id}]${timing}
Speaker: ${segment.speakerName || 'Unknown'}
Position: ${segment.from}-${segment.to}
Text: "${segment.text}"`;
  }).join('\n\n');
}

/**
 * Build position index for fast lookups
 */
export function buildPositionIndex(segments: PositionAwareSegment[]): Map<number, PositionAwareSegment> {
  const index = new Map<number, PositionAwareSegment>();
  
  segments.forEach(segment => {
    for (let pos = segment.from; pos < segment.to; pos++) {
      index.set(pos, segment);
    }
  });
  
  return index;
}