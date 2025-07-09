import type { Word } from '$lib/helpers/converters/types';

export interface ExtractedWord {
  text: string;
  start: number;
  end: number;
  speakerTag: string;
}

export function extractWordsFromEditor(content: any): ExtractedWord[] {
  const words: ExtractedWord[] = [];
  
  function traverseNode(node: any, currentSpeaker: string = '') {
    if (node.type === 'speaker') {
      // Extract speaker name from speaker node
      const speakerName = node.attrs?.['data-name'] || node.attrs?.name || 'Unknown Speaker';
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
      const wordMark = node.marks.find((mark: any) => mark.type === 'word');
      if (wordMark && wordMark.attrs) {
        words.push({
          text: node.text,
          start: wordMark.attrs.start || 0,
          end: wordMark.attrs.end || 0,
          speakerTag: currentSpeaker
        });
      }
    }
  }
  
  if (content && content.content) {
    traverseNode(content);
  }
  
  return words;
}

export function extractTranscriptTitle(content: any): string {
  // Try to extract a meaningful title from the content
  if (content && content.content && content.content.length > 0) {
    // Look for the first speaker node and get some text from it
    const firstSpeaker = content.content.find((node: any) => node.type === 'speaker');
    if (firstSpeaker && firstSpeaker.content) {
      // Get the first few words as a title
      const words: string[] = [];
      const traverseForWords = (node: any) => {
        if (node.type === 'text') {
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