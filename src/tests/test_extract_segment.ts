import { extractWordsFromEditor, type ExtractedWord } from '$lib/utils/extractWordsFromEditor';
import type { TipTapEditorContent } from '../types';
import { testContent } from './testEditorContent';
import fs from 'fs';
import path from 'path';

// Function to extract exactly one paragraph/block from the content
function extractOneParagraph(content: TipTapEditorContent) {
	if (!content || !content.content || content.content.length === 0) {
		return null;
	}

	// Take the first paragraph/block
	const firstBlock = content.content[0];
	if (!firstBlock) return null;

	// Create a new document with just this one block
	const singleBlockContent: TipTapEditorContent = {
		type: 'doc',
		content: [firstBlock]
	};

	return singleBlockContent;
}

// Helper function to format timing display
function formatTiming(word: ExtractedWord): string {
	return `${word.start}s - ${word.end}s`;
}

async function runSegmentTest() {
	try {
		console.log('Starting single paragraph extraction test...');

		// Extract one paragraph
		const singleParagraph = extractOneParagraph(testContent);

		if (!singleParagraph) {
			console.error('No content found to extract');
			return;
		}

		// Extract words from the single paragraph
		const words = extractWordsFromEditor(singleParagraph);

		console.log(`Extracted ${words.length} words from single paragraph`);

		// Display first few words with timing
		console.log('\nFirst 10 words:');
		words.slice(0, 10).forEach((word, index) => {
			console.log(`${index + 1}. "${word.text}" (${formatTiming(word)}) - ${word.speakerTag}`);
		});

		// Save the single paragraph content to file
		const outputPath = path.join(process.cwd(), 'tmp', 'extracted_single_paragraph.json');
		const outputData = {
			paragraphCount: 1,
			wordCount: words.length,
			content: singleParagraph,
			extractedWords: words,
			timestamp: new Date().toISOString()
		};

		// Ensure tmp directory exists
		const tmpDir = path.dirname(outputPath);
		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir, { recursive: true });
		}

		fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
		console.log(`\nSingle paragraph saved to: ${outputPath}`);
	} catch (error) {
		console.error('Segment test failed:', error);
	}
}

runSegmentTest();
