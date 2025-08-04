import { extractFullTextWithSpeakers, extractTranscriptTitle } from '$lib/utils/extractWordsFromEditor';
import { testContent } from './testEditorContent';
import fs from 'fs';
import path from 'path';

async function runFullTextTest() {
  try {
    console.log('Starting full text extraction test...');

    // Extract full text with speakers
    const fullText = extractFullTextWithSpeakers(testContent);
    
    // Extract title for reference
    const title = extractTranscriptTitle(testContent);
    
    console.log(`Title: ${title}`);
    console.log(`\nExtracted full text with speakers:`);
    console.log('=' .repeat(80));
    console.log(fullText);
    console.log('=' .repeat(80));
    
    // Count paragraphs and characters
    const paragraphs = fullText.split('\n\n').filter(p => p.trim());
    const characterCount = fullText.length;
    const wordCount = fullText.split(/\s+/).filter(word => word.trim()).length;
    
    console.log(`\nStatistics:`);
    console.log(`- Paragraphs: ${paragraphs.length}`);
    console.log(`- Characters: ${characterCount}`);
    console.log(`- Words: ${wordCount}`);
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'tmp', 'extracted_full_text.txt');
    const jsonOutputPath = path.join(process.cwd(), 'tmp', 'extracted_full_text.json');
    
    // Ensure tmp directory exists
    const tmpDir = path.dirname(outputPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Save as plain text
    fs.writeFileSync(outputPath, fullText);
    console.log(`\nFull text saved to: ${outputPath}`);
    
    // Save as JSON with metadata
    const jsonData = {
      title,
      fullText,
      statistics: {
        paragraphs: paragraphs.length,
        characters: characterCount,
        words: wordCount
      },
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonData, null, 2));
    console.log(`JSON data saved to: ${jsonOutputPath}`);
    
  } catch (error) {
    console.error('Full text test failed:', error);
  }
}

runFullTextTest(); 