import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

export interface TextMatch {
	from: number;
	to: number;
	text: string;
}

export interface ReplacementResult {
	success: boolean;
	error?: string;
	matchCount?: number;
	replacedAt?: number;
}

/**
 * Find text with flexible whitespace matching
 * This handles cases where the search text has different whitespace than the document
 */
export function findTextFlexible(
	doc: ProseMirrorNode,
	searchText: string,
	options: {
		caseSensitive?: boolean;
	} = {}
): TextMatch[] {
	const { caseSensitive = false } = options;
	const matches: TextMatch[] = [];

	console.log('\n=== Flexible Text Search ===');
	console.log('Searching for:', JSON.stringify(searchText));

	// Get the full document text
	const fullText = doc.textBetween(0, doc.content.size, ' ');

	// Normalize the search text - collapse multiple spaces to single space
	const normalizedSearch = searchText.replace(/\s+/g, ' ').trim();
	const searchWords = normalizedSearch.split(' ');

	console.log('Search words:', searchWords);
	console.log('Document length:', fullText.length);

	// Create a flexible regex pattern that allows any whitespace between words
	const escapedWords = searchWords.map(
		(word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
	);
	const pattern = escapedWords.join('\\s+'); // Allow any whitespace between words
	const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

	console.log('Search pattern:', pattern);

	// Find all matches
	let match;
	while ((match = regex.exec(fullText)) !== null) {
		const matchStart = match.index;
		const matchEnd = matchStart + match[0].length;
		const matchedText = match[0];

		console.log(`Found match at ${matchStart}-${matchEnd}: "${matchedText}"`);

		// Now map string positions to document positions
		let docPos = 0;
		let stringPos = 0;
		let fromPos = -1;
		let toPos = -1;

		doc.descendants((node, pos) => {
			if (fromPos !== -1 && toPos !== -1) return false; // Stop if we found both

			if (node.isText && node.text) {
				const nodeEnd = stringPos + node.text.length;

				// Check if match starts in this node
				if (fromPos === -1 && matchStart >= stringPos && matchStart < nodeEnd) {
					fromPos = pos + (matchStart - stringPos);
				}

				// Check if match ends in this node
				if (matchEnd > stringPos && matchEnd <= nodeEnd) {
					toPos = pos + (matchEnd - stringPos);
				}

				stringPos = nodeEnd;
			} else if (node.isBlock && stringPos > 0) {
				// Account for space added between blocks
				stringPos += 1;
			}
		});

		if (fromPos !== -1 && toPos !== -1) {
			// Verify by getting actual text
			const actualText = doc.textBetween(fromPos, toPos);
			console.log(`  Verified: "${actualText}" at document positions ${fromPos}-${toPos}`);

			matches.push({
				from: fromPos,
				to: toPos,
				text: actualText
			});
		} else {
			console.log(`  Warning: Could not map to document positions`);
		}
	}

	console.log(`Found ${matches.length} flexible matches\n`);
	return matches;
}

/**
 * Find and create diff with flexible whitespace matching
 */
export function findAndCreateDiffFlexible(
	editor: Editor,
	searchText: string,
	suggestedText: string,
	options: {
		caseSensitive?: boolean;
		changeType?: string;
		confidence?: number;
		context?: string;
	} = {}
): ReplacementResult {
	const { state } = editor;
	const { doc } = state;

	// Try flexible search
	const matches = findTextFlexible(doc, searchText, options);

	if (matches.length === 0) {
		return {
			success: false,
			error: `Text "${searchText}" not found (even with flexible whitespace matching).`,
			matchCount: 0
		};
	}

	if (matches.length > 1) {
		return {
			success: false,
			error: `Multiple matches found (${matches.length}). Please be more specific.`,
			matchCount: matches.length
		};
	}

	// Create diff node for the match
	const match = matches[0];
	const { changeType = 'text_replacement', confidence = 0.5, context } = options;

	try {
		const diffId = `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const success = editor
			.chain()
			.focus()
			.command(({ tr, state }) => {
				if (!state.schema.nodes.diff) {
					console.error('Diff node type not registered');
					return false;
				}

				const diffNode = state.schema.nodes.diff.create({
					id: diffId,
					originalText: match.text,
					suggestedText,
					changeType,
					confidence,
					context: context || '',
					from: match.from,
					to: match.to
				});

				tr.replaceWith(match.from, match.to, diffNode);
				console.log(`Created diff node with flexible match at ${match.from}-${match.to}`);

				return true;
			})
			.run();

		return {
			success,
			replacedAt: match.from,
			matchCount: 1
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to create diff node'
		};
	}
}
