import type { TipTapEditorContent } from '../../types';

export interface ExtractedWord {
	text: string;
	start: number;
	end: number;
	speakerTag: string;
	wordIndex?: number; // Index in timingArray (for new format)
}

interface EditorNode {
	type: string;
	attrs?: {
		'data-name'?: string;
		id?: string;
		topic?: string | null;
		text?: string;
		start?: number;
		end?: number;
		alternatives?: string | Array<{ rank: number; text: string; avg_logprob: number }>;
	};
	content?: EditorNode[];
	text?: string;
	textContent?: string;
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

/**
 * Reconstruct text from words preserving punctuation and spacing
 * This handles the case where words might include punctuation that shouldn't be separated by spaces
 */
function reconstructTextFromWords(words: ExtractedWord[]): string {
	if (words.length === 0) return '';

	let result = '';

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		const wordText = word.text || '';

		if (i === 0) {
			// First word - no space before
			result = wordText;
		} else {
			// Check if the current word starts with punctuation that shouldn't have space before it
			const startsWithNonSpacePunctuation = /^[.,;:!?)\]}"'»]/.test(wordText);

			if (startsWithNonSpacePunctuation) {
				// No space before punctuation
				result += wordText;
			} else {
				// Add space before word
				result += ' ' + wordText;
			}
		}
	}

	return result;
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

export interface SegmentWithTiming {
	index: number;
	startTime: number;
	endTime: number;
	startWord: number;
	endWord: number;
	text: string;
	speakerTag: string;
	speakerName?: string; // Added to distinguish from speakerTag
	words: ExtractedWord[];
	alternatives?: Array<{ rank: number; text: string; avg_logprob: number }>; // ASR alternative hypotheses
}

export function extractSegmentsWithTiming(
	content: TipTapEditorContent,
	wordsPerSegment: number = 200
): SegmentWithTiming[] {
	const words = extractWordsFromEditor(content);
	const segments: SegmentWithTiming[] = [];

	if (words.length === 0) {
		return segments;
	}

	for (let i = 0; i < words.length; i += wordsPerSegment) {
		const segmentWords = words.slice(i, Math.min(i + wordsPerSegment, words.length));

		if (segmentWords.length > 0) {
			// Get the speaker from the first word in the segment
			const speakerTag = segmentWords[0].speakerTag || 'Unknown Speaker';

			segments.push({
				index: Math.floor(i / wordsPerSegment),
				startTime: segmentWords[0].start,
				endTime: segmentWords[segmentWords.length - 1].end,
				startWord: i,
				endWord: Math.min(i + wordsPerSegment - 1, words.length - 1),
				text: segmentWords.map((w) => w.text).join(' '),
				speakerTag,
				words: segmentWords
			});
		}
	}

	return segments;
}

export function getSegmentByIndex(
	content: TipTapEditorContent,
	segmentIndex: number,
	wordsPerSegment: number = 200
): SegmentWithTiming | null {
	const segments = extractSegmentsWithTiming(content, wordsPerSegment);
	return segments[segmentIndex] || null;
}

/**
 * Extract segments based on speaker blocks instead of word count
 * Each segment represents one complete speaker turn
 */
/**
 * Extract segments from the editor using the new WordTimingPlugin architecture
 *
 * This function is specifically for extracting segments from the EDITOR (not ASR backend JSON).
 * It uses the WordTimingPlugin to get timing data and filters out space-only nodes.
 *
 * @param editor - TipTap editor instance (needed to access WordTimingPlugin)
 * @param content - TipTap editor content (document structure)
 * @returns Array of segments with wordIndex references and timing data
 */
export function extractSegmentsFromEditor(
	editor: any,
	content: TipTapEditorContent
): SegmentWithTiming[] {
	const segments: SegmentWithTiming[] = [];
	let segmentIndex = 0;

	if (!content || !content.content) {
		return segments;
	}

	// Get timing data from WordTimingPlugin
	let timingArray: Array<{ start: number; end: number }> = [];
	try {
		// Import plugin utilities
		const { getTimingPluginState } = require('../components/plugins/wordTimingPlugin');
		const pluginState = getTimingPluginState(editor);
		if (pluginState && pluginState.timingArray) {
			timingArray = pluginState.timingArray;
		}
	} catch (error) {
		console.warn('[extractSegmentsFromEditor] Could not access WordTimingPlugin:', error);
	}

	// Process each speaker node
	for (const speakerNode of content.content) {
		if (speakerNode.type !== 'speaker') {
			continue;
		}

		const speakerName = speakerNode.attrs?.['data-name'] || 'Unknown Speaker';
		const words: ExtractedWord[] = [];

		// Extract words from this speaker block (filtering out spaces)
		function extractWordsFromNode(node: EditorNode) {
			// Handle wordNode type (AI editor format with wordIndex)
			if (node.type === 'wordNode' && node.attrs) {
				const wordIndex = node.attrs.wordIndex;
				const text = node.attrs.text || (node.content && node.content[0]?.text) || '';

				// Filter out space-only nodes
				const trimmed = text.trim();
				if (trimmed.length === 0) {
					return; // Skip space-only nodes
				}

				// Get timing from timingArray if available
				let start = 0;
				let end = 0;
				if (wordIndex !== undefined && wordIndex !== null && timingArray[wordIndex]) {
					start = timingArray[wordIndex].start;
					end = timingArray[wordIndex].end;
				}

				words.push({
					text: text,
					start,
					end,
					speakerTag: speakerName,
					wordIndex: wordIndex // Store wordIndex for position lookup
				});
			}

			// Handle regular text nodes with word marks (legacy format)
			if (node.type === 'text' && node.marks) {
				const wordMark = node.marks.find((mark: EditorMark) => mark.type === 'word');
				if (wordMark && wordMark.attrs && node.text) {
					const trimmed = node.text.trim();
					if (trimmed.length === 0) {
						return; // Skip space-only nodes
					}

					const start = wordMark.attrs.start || 0;
					const end = wordMark.attrs.end || 0;

					words.push({
						text: node.text,
						start,
						end,
						speakerTag: speakerName
					});
				}
			}

			// Recursively process child nodes
			if (node.content && Array.isArray(node.content)) {
				for (const child of node.content) {
					extractWordsFromNode(child);
				}
			}
		}

		// Extract words from the speaker node
		extractWordsFromNode(speakerNode);

		// Only create a segment if there are words
		if (words.length > 0) {
			const startTime = words[0].start;
			let endTime = words[words.length - 1].end;

			// Validate and fix timing silently
			if (endTime <= startTime) {
				const maxEnd = Math.max(...words.map((w) => w.end));
				if (maxEnd > startTime) {
					endTime = maxEnd;
				} else {
					endTime = startTime + 1;
				}
			}

			// Reconstruct text from words (no extra spaces since we filtered them)
			const reconstructedText = words
				.map((w) => w.text)
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();

			segments.push({
				index: segmentIndex,
				startTime,
				endTime,
				startWord: 0,
				endWord: words.length - 1,
				text: reconstructedText,
				speakerTag: speakerName,
				speakerName: speakerName,
				words: words
			});

			segmentIndex++;
		}
	}

	console.log(`[extractSegmentsFromEditor] Extracted ${segments.length} segments, total words: ${segments.reduce((sum, s) => sum + s.words.length, 0)}`);
	return segments;
}

/**
 * Extract segments based on speaker blocks (legacy function for ASR backend JSON parsing)
 *
 * This function is for parsing ASR backend JSON, NOT for extracting from the editor.
 * For editor extraction, use extractSegmentsFromEditor() instead.
 */
export function extractSpeakerSegments(content: TipTapEditorContent): SegmentWithTiming[] {
	const segments: SegmentWithTiming[] = [];
	let segmentIndex = 0;
	let globalWordIndex = 0;

	if (!content || !content.content) {
		return segments;
	}

	// Process each speaker node
	for (const speakerNode of content.content) {
		if (speakerNode.type !== 'speaker') {
			continue;
		}

		const speakerName = speakerNode.attrs?.['data-name'] || 'Unknown Speaker';
		
		// Parse alternatives from speaker node if available
		let speakerAlternatives: Array<{ rank: number; text: string; avg_logprob: number }> = [];
		if (speakerNode.attrs?.alternatives) {
			try {
				const alternativesStr = speakerNode.attrs.alternatives;
				if (typeof alternativesStr === 'string') {
					speakerAlternatives = JSON.parse(alternativesStr);
				} else if (Array.isArray(alternativesStr)) {
					speakerAlternatives = alternativesStr;
				}
			} catch (error) {
				// Silently ignore JSON parse errors - alternatives will remain empty
			}
		}
		
		const speakerWords: ExtractedWord[] = [];

		// Extract all words from this speaker block
		function extractWordsFromNode(node: EditorNode) {
			// Handle regular text nodes with word marks (original format)
			if (node.type === 'text' && node.marks) {
				const wordMark = node.marks.find((mark: EditorMark) => mark.type === 'word');
				if (wordMark && wordMark.attrs && node.text) {
					const start = wordMark.attrs.start || 0;
					const end = wordMark.attrs.end || 0;

					speakerWords.push({
						text: node.text,
						start,
						end,
						speakerTag: speakerName
					});
				}
			}

			// Handle wordNode type (AI editor format)
			if (node.type === 'wordNode' && node.attrs) {
				// NEW format: text is in node.content[0].text
				// OLD format: text is in node.attrs.text
				let text = node.attrs.text || '';
				if (!text && node.content && node.content[0] && node.content[0].text) {
					text = node.content[0].text;
				}

				const start = node.attrs.start || 0;
				const end = node.attrs.end || 0;

				// Filter out space-only text
				if (text && text.trim().length > 0) {
					speakerWords.push({
						text: text,
						start,
						end,
						speakerTag: speakerName
					});
				}
			}

			// Handle plain text nodes (might contain spaces or punctuation)
			if (node.type === 'text' && node.text && !node.marks) {
				// For plain text nodes without marks, we can't get timing info
				// but we should still include the text
				speakerWords.push({
					text: node.text,
					start: 0,
					end: 0,
					speakerTag: speakerName
				});
			}

			// Recursively process child nodes
			if (node.content && Array.isArray(node.content)) {
				for (const child of node.content) {
					extractWordsFromNode(child);
				}
			}
		}

		// Extract words from the speaker node
		extractWordsFromNode(speakerNode);

		// Only create a segment if there are words
		if (speakerWords.length > 0) {
			const startTime = speakerWords[0].start;
			let endTime = speakerWords[speakerWords.length - 1].end;

			// Validate and fix timing silently
			if (endTime <= startTime) {
				// Try to fix by using the maximum end time from all words
				const maxEnd = Math.max(...speakerWords.map((w) => w.end));
				if (maxEnd > startTime) {
					endTime = maxEnd;
				} else {
					// Fallback: set end time to start + 1 second
					endTime = startTime + 1;
				}
			}

			// Normalize text to match how AI suggestions were generated:
			// 1. Join words with single spaces
			// 2. Normalize multiple whitespace to single spaces
			// 3. Trim leading/trailing whitespace
			const reconstructedText = speakerWords
				.map((w) => w.text)
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();

			segments.push({
				index: segmentIndex,
				startTime,
				endTime,
				startWord: globalWordIndex,
				endWord: globalWordIndex + speakerWords.length - 1,
				text: reconstructedText,
				speakerTag: speakerName,
				speakerName: speakerName,
				words: speakerWords,
				alternatives: speakerAlternatives
			});

			segmentIndex++;
			globalWordIndex += speakerWords.length;
		}
	}

	return segments;
}
