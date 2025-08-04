import type { TipTapEditorContent } from '../../types';

export interface ExtractedWord {
  text: string;
  start: number;
  end: number;
  speakerTag: string;
}

interface EditorNode {
  type: string;
  attrs?: {
    "data-name"?: string;
    id?: string;
    topic?: string | null;
  };
  content?: EditorNode[];
  text?: string;
  marks?: EditorMark[];
}

interface EditorMark {
  type: string;
  attrs?: {
    start?: number;
    end?: number;
    id?: string;
    lang?: string;
    spellcheck?: string;
  };
}

export function extractWordsFromEditor(content: TipTapEditorContent): ExtractedWord[] {
  const words: ExtractedWord[] = [];
  
  function traverseNode(node: EditorNode, currentSpeaker: string = '') {
    if (node.type === 'speaker') {
      // Extract speaker name from speaker node
      const speakerName = node.attrs?.['data-name'] || 'Unknown Speaker';
      currentSpeaker = speakerName;
    }
    
    if (node.content && Array.isArray(node.content)) {
      // Recursively traverse child nodes
      for (const child of node.content) {
        traverseNode(child, currentSpeaker);
      }
    }
    
    if (node.type === 'text' && node.marks) {
      // Find word mark with timing information
      const wordMark = node.marks.find((mark: EditorMark) => mark.type === 'word');
      if (wordMark && wordMark.attrs) {
        const start = wordMark.attrs.start || 0;
        const end = wordMark.attrs.end || 0;
        
        words.push({
          text: node.text || '',
          start,
          end,
          speakerTag: currentSpeaker
        });
      }
    }
  }
  
  if (content && content.content) {
    traverseNode(content as EditorNode);
  }
  
  return words;
}

export function extractFullTextWithSpeakers(content: TipTapEditorContent): string {
  const paragraphs: string[] = [];
  
  if (content && content.content) {
    for (const speakerNode of content.content) {
      if (speakerNode.type === 'speaker') {
        const speakerName = speakerNode.attrs?.['data-name'] || 'Unknown Speaker';
        let paragraphText = '';
        
        // Collect all text from this speaker
        const collectText = (node: EditorNode) => {
          if (node.type === 'text' && node.text) {
            paragraphText += node.text;
          }
          if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
              collectText(child);
            }
          }
        };
        
        collectText(speakerNode);
        
        if (paragraphText.trim()) {
          paragraphs.push(`${speakerName}: ${paragraphText.trim()}`);
        }
      }
    }
  }
  
  return paragraphs.join('\n\n');
}

export function extractTranscriptTitle(content: TipTapEditorContent): string {
  // Try to extract a meaningful title from the content
  if (content && content.content && content.content.length > 0) {
    // Look for the first speaker node and get some text from it
    const firstSpeaker = content.content.find((node: EditorNode) => node.type === 'speaker');
    if (firstSpeaker && firstSpeaker.content) {
      // Get the first few words as a title
      const words: string[] = [];
      const traverseForWords = (node: EditorNode) => {
        if (node.type === 'text' && node.text) {
          words.push(node.text);
        }
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            traverseForWords(child);
          }
        }
      };
      
      traverseForWords(firstSpeaker);
      
      // Take first 10 words or less
      const titleWords = words.slice(0, 10).join(' ');
      return titleWords.length > 50 ? titleWords.substring(0, 50) + '...' : titleWords;
    }
  }
  
  return 'Untitled Transcript';
} 