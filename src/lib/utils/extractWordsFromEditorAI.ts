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
		'data-name'?: string;
		id?: string;
		topic?: string | null;
		// Word node attributes
		start?: number;
		end?: number;
		lang?: string;
		spellcheck?: string;
	};
	content?: EditorNode[];
	text?: string;
}

/**
 * Extract words from editor using Word nodes (not marks)
 */
export function extractWordsFromEditor(content: TipTapEditorContent): ExtractedWord[] {
	const words: ExtractedWord[] = [];

	function traverseNode(node: EditorNode, currentSpeaker: string = '') {
		if (node.type === 'speaker') {
			// Extract speaker name from speaker node
			const speakerName = node.attrs?.['data-name'] || 'Unknown Speaker';
			currentSpeaker = speakerName;
		}

		// Handle Word nodes (not text with marks)
		if (node.type === 'wordNode' && node.attrs) {
			// Get text from Word node content
			let wordText = '';
			if (node.content && Array.isArray(node.content)) {
				for (const child of node.content) {
					if (child.type === 'text' && child.text) {
						wordText += child.text;
					}
				}
			}

			const start = node.attrs.start || 0;
			const end = node.attrs.end || 0;

			words.push({
				text: wordText,
				start,
				end,
				speakerTag: currentSpeaker
			});
		}

		// Continue traversing child nodes
		if (node.content && Array.isArray(node.content)) {
			for (const child of node.content) {
				traverseNode(child, currentSpeaker);
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

				// Collect all text from this speaker (from Word nodes and text nodes)
				const collectText = (node: EditorNode) => {
					if (node.type === 'wordNode') {
						// Extract text from Word node
						if (node.content && Array.isArray(node.content)) {
							for (const child of node.content) {
								if (child.type === 'text' && child.text) {
									paragraphText += child.text;
								}
							}
						}
					} else if (node.type === 'text' && node.text) {
						// Add plain text (spaces, etc.)
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

export interface SegmentWithTiming {
	speaker: string;
	speakerId: string;
	text: string;
	wordCount: number;
	charCount: number;
	start: number;
	end: number;
	duration: number;
	absolutePosition: number;
	alternatives?: Array<{ rank: number; text: string; avg_logprob: number }>; // ASR alternative hypotheses
}

/**
 * Extract speaker segments with timing information from Word nodes
 */
export function extractSpeakerSegmentsWithTiming(
	content: TipTapEditorContent,
	options: { withFullText?: boolean } = {}
): SegmentWithTiming[] {
	const words = extractWordsFromEditor(content);
	const segments: SegmentWithTiming[] = [];
	let currentSegment: SegmentWithTiming | null = null;
	let absolutePosition = 0;

	for (const word of words) {
		if (!currentSegment || currentSegment.speaker !== word.speakerTag) {
			// Start new segment
			if (currentSegment) {
				segments.push(currentSegment);
				absolutePosition += currentSegment.text.length + 1; // +1 for newline
			}
			currentSegment = {
				speaker: word.speakerTag,
				speakerId: `speaker_${segments.length}`,
				text: word.text,
				wordCount: 1,
				charCount: word.text.length,
				start: word.start,
				end: word.end,
				duration: word.end - word.start,
				absolutePosition
			};
		} else {
			// Continue current segment
			currentSegment.text += ' ' + word.text;
			currentSegment.wordCount++;
			currentSegment.charCount += word.text.length + 1;
			currentSegment.end = word.end;
			currentSegment.duration = currentSegment.end - currentSegment.start;
		}
	}

	if (currentSegment) {
		segments.push(currentSegment);
	}

	return segments;
}

/**
 * Extract speaker segments (simpler version)
 */
export function extractSpeakerSegments(content: TipTapEditorContent): SegmentWithTiming[] {
	const segments: SegmentWithTiming[] = [];
	let absolutePosition = 0;

	if (content && content.content) {
		for (const speakerNode of content.content) {
			if (speakerNode.type === 'speaker') {
				const speakerName = speakerNode.attrs?.['data-name'] || 'Unknown Speaker';
				const speakerId = speakerNode.attrs?.id || `speaker_${segments.length}`;

				let segmentText = '';
				let firstTime: number | null = null;
				let lastTime: number | null = null;
				let wordCount = 0;

				// Collect text and timing from Word nodes
				const collectData = (node: EditorNode) => {
					if (node.type === 'wordNode') {
						wordCount++;

						// Extract text
						if (node.content && Array.isArray(node.content)) {
							for (const child of node.content) {
								if (child.type === 'text' && child.text) {
									segmentText += child.text;
								}
							}
						}

						// Track timing
						if (node.attrs) {
							if (
								node.attrs.start !== undefined &&
								(firstTime === null || node.attrs.start < firstTime)
							) {
								firstTime = node.attrs.start;
							}
							if (
								node.attrs.end !== undefined &&
								(lastTime === null || node.attrs.end > lastTime)
							) {
								lastTime = node.attrs.end;
							}
						}
					} else if (node.type === 'text' && node.text) {
						// Add spaces and other text
						segmentText += node.text;
					}

					if (node.content && Array.isArray(node.content)) {
						for (const child of node.content) {
							collectData(child);
						}
					}
				};

				collectData(speakerNode);

				const trimmedText = segmentText.trim();
				if (trimmedText) {
					segments.push({
						speaker: speakerName,
						speakerId: speakerId,
						text: trimmedText,
						wordCount: wordCount,
						charCount: trimmedText.length,
						start: firstTime || 0,
						end: lastTime || 0,
						duration: (lastTime || 0) - (firstTime || 0),
						absolutePosition: absolutePosition
					});
					absolutePosition += trimmedText.length + 1;
				}
			}
		}
	}

	return segments;
}
