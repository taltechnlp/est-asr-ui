import {
	extractWordsFromEditor,
	extractTranscriptTitle,
	type ExtractedWord
} from '$lib/utils/extractWordsFromEditor';
import { testContent } from './testEditorContent';
import fs from 'fs';
import path from 'path';

// Helper function to format timing display
function formatTiming(word: ExtractedWord): string {
	return `${word.start}s - ${word.end}s`;
}

async function runTest() {
	try {
		console.log('Starting word extraction test...');

		// Extract words from testContent
		const words = extractWordsFromEditor(testContent);

		// Extract title
		const title = extractTranscriptTitle(testContent);

		console.log(`Extracted ${words.length} words`);
		console.log(`Title: ${title}`);

		// Display first 20 extracted words
		console.log('\nFirst 20 words:');
		words.slice(0, 20).forEach((word, index) => {
			console.log(`${index + 1}. "${word.text}" (${formatTiming(word)}) - ${word.speakerTag}`);
		});

		if (words.length > 20) {
			console.log(`... and ${words.length - 20} more words`);
		}

		// Save to file
		const outputPath = path.join(process.cwd(), 'tmp', 'extracted_words_test.json');
		const outputData = {
			title,
			wordCount: words.length,
			words,
			timestamp: new Date().toISOString()
		};

		// Ensure tmp directory exists
		const tmpDir = path.dirname(outputPath);
		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir, { recursive: true });
		}

		fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
		console.log(`\nResults saved to: ${outputPath}`);
	} catch (error) {
		console.error('Test failed:', error);
	}
}

runTest();
