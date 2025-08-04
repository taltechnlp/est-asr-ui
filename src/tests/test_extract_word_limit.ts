import { extractWordsFromEditor, type ExtractedWord } from '$lib/utils/extractWordsFromEditor';
import type { TipTapEditorContent } from '../types';
import { testContent } from './testEditorContent';
import fs from 'fs';
import path from 'path';

// Function to extract paragraphs until word count limit
function extractParagraphsUntilWordLimit(content: TipTapEditorContent, wordLimit: number = 200) {
	if (!content || !content.content || content.content.length === 0) {
		return null;
	}

	const selectedBlocks = [];
	let totalWords = 0;
	let blockIndex = 0;

	// Always include at least one paragraph
	if (content.content.length > 0) {
		const firstBlock = content.content[0];
		if (!firstBlock) return null;

		selectedBlocks.push(firstBlock);

		// Count words in the first block
		const firstBlockContent: TipTapEditorContent = {
			type: 'doc',
			content: [firstBlock]
		};
		const firstBlockWords = extractWordsFromEditor(firstBlockContent);
		totalWords = firstBlockWords.length;
		blockIndex = 1;
	}

	// Continue adding blocks until we reach the word limit
	while (blockIndex < content.content.length && totalWords < wordLimit) {
		const currentBlock = content.content[blockIndex];
		if (!currentBlock) {
			blockIndex++;
			continue;
		}

		// Count words in this block
		const blockContent: TipTapEditorContent = {
			type: 'doc',
			content: [currentBlock]
		};
		const blockWords = extractWordsFromEditor(blockContent);

		// If adding this block would exceed the limit, stop
		if (totalWords + blockWords.length > wordLimit) {
			break;
		}

		// Add the block
		selectedBlocks.push(currentBlock);
		totalWords += blockWords.length;
		blockIndex++;
	}

	// Create the final content with selected blocks
	const limitedContent: TipTapEditorContent = {
		type: 'doc',
		content: selectedBlocks.filter(
			(block): block is NonNullable<typeof block> => block !== undefined
		)
	};

	return { content: limitedContent, wordCount: totalWords, blockCount: selectedBlocks.length };
}

// Helper function to format timing display
function formatTiming(word: ExtractedWord): string {
	return `${word.start}s - ${word.end}s`;
}

async function runWordLimitTest() {
	try {
		console.log('Starting word limit extraction test...');

		const wordLimit = 200;
		console.log(`Target word limit: ${wordLimit}`);

		// Extract paragraphs until word limit
		const result = extractParagraphsUntilWordLimit(testContent, wordLimit);

		if (!result) {
			console.error('No content found to extract');
			return;
		}

		// Extract words from the limited content
		const words = extractWordsFromEditor(result.content);

		console.log(`Extracted ${result.blockCount} paragraphs with ${result.wordCount} words`);
		console.log(`Actual word count: ${words.length}`);

		// Display first few words with timing
		console.log('\nFirst 15 words:');
		words.slice(0, 15).forEach((word, index) => {
			console.log(`${index + 1}. "${word.text}" (${formatTiming(word)}) - ${word.speakerTag}`);
		});

		// Save the limited content to file
		const outputPath = path.join(process.cwd(), 'tmp', 'extracted_word_limit.json');
		const outputData = {
			targetWordLimit: wordLimit,
			actualWordCount: result.wordCount,
			paragraphCount: result.blockCount,
			content: result.content,
			extractedWords: words,
			timestamp: new Date().toISOString()
		};

		// Ensure tmp directory exists
		const tmpDir = path.dirname(outputPath);
		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir, { recursive: true });
		}

		fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
		console.log(`\nWord-limited content saved to: ${outputPath}`);
	} catch (error) {
		console.error('Word limit test failed:', error);
	}
}

runWordLimitTest();
