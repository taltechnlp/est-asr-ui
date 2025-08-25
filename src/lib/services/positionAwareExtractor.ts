import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model';

/**
 * Position-aware document segment with absolute positions
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

	// Marks on this segment
	marks?: Array<{
		type: string;
		attrs?: Record<string, any>;
	}>;

	// Speaker information if in speaker block
	speakerName?: string;
	speakerId?: string;

	// Timing information if available
	startTime?: number;
	endTime?: number;

	// Hierarchical path in document
	path: number[];
}

/**
 * Position index for fast lookups
 */
export interface PositionIndex {
	segments: PositionAwareSegment[];
	textToPosition: Map<string, number[]>; // Map text to positions
	positionToSegment: Map<number, PositionAwareSegment>; // Map position to segment
	version: number; // Document version for validation
}

/**
 * Extract position-aware segments from the editor
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

		// Process text nodes
		if (node.isText && node.text) {
			const marks = node.marks.map((mark) => ({
				type: mark.type.name,
				attrs: mark.attrs
			}));

			// Extract timing from word marks
			let startTime: number | undefined;
			let endTime: number | undefined;
			const wordMark = node.marks.find((m) => m.type.name === 'word');
			if (wordMark?.attrs) {
				startTime = wordMark.attrs.start;
				endTime = wordMark.attrs.end;
			}

			const segment: PositionAwareSegment = {
				id: `seg_${segmentId++}`,
				from: pos,
				to: pos + node.nodeSize,
				text: node.text,
				startOffset: 0,
				endOffset: node.text.length,
				nodeType: 'text',
				parentType: parent?.type.name,
				parentAttrs: parent?.attrs,
				marks: marks.length > 0 ? marks : undefined,
				speakerName: currentSpeaker,
				speakerId: currentSpeakerId,
				startTime,
				endTime,
				path: getNodePath(doc, pos)
			};

			segments.push(segment);
		}

		// Also track structural nodes (paragraphs, headings, etc.)
		if (node.type.name === 'paragraph' || node.type.name === 'heading') {
			const textContent = node.textContent;
			if (textContent) {
				const segment: PositionAwareSegment = {
					id: `seg_${segmentId++}`,
					from: pos,
					to: pos + node.nodeSize,
					text: textContent,
					startOffset: 0,
					endOffset: textContent.length,
					nodeType: node.type.name,
					nodeAttrs: node.attrs,
					parentType: parent?.type.name,
					parentAttrs: parent?.attrs,
					speakerName: currentSpeaker,
					speakerId: currentSpeakerId,
					path: getNodePath(doc, pos)
				};

				segments.push(segment);
			}
		}
	});

	return segments;
}

/**
 * Extract speaker-based segments with positions
 */
export function extractSpeakerSegmentsWithPositions(editor: Editor): PositionAwareSegment[] {
	const doc = editor.state.doc;
	const segments: PositionAwareSegment[] = [];
	let segmentId = 0;

	// Find all speaker nodes
	doc.nodesBetween(0, doc.content.size, (node, pos) => {
		if (node.type.name === 'speaker') {
			const speakerName = node.attrs['data-name'] || 'Unknown Speaker';
			const speakerId = node.attrs.id;
			const textContent = node.textContent;

			if (textContent) {
				// Collect timing information from word marks
				let minStart: number | undefined;
				let maxEnd: number | undefined;

				node.descendants((child) => {
					if (child.isText) {
						const wordMark = child.marks.find((m) => m.type.name === 'word');
						if (wordMark?.attrs) {
							const start = wordMark.attrs.start;
							const end = wordMark.attrs.end;

							if (start !== undefined) {
								minStart = minStart === undefined ? start : Math.min(minStart, start);
							}
							if (end !== undefined) {
								maxEnd = maxEnd === undefined ? end : Math.max(maxEnd, end);
							}
						}
					}
				});

				const segment: PositionAwareSegment = {
					id: `speaker_${segmentId++}`,
					from: pos,
					to: pos + node.nodeSize,
					text: textContent,
					startOffset: 0,
					endOffset: textContent.length,
					nodeType: 'speaker',
					nodeAttrs: node.attrs,
					speakerName,
					speakerId,
					startTime: minStart,
					endTime: maxEnd,
					path: getNodePath(doc, pos)
				};

				segments.push(segment);
			}
		}
	});

	return segments;
}

/**
 * Build position index for fast lookups
 */
export function buildPositionIndex(segments: PositionAwareSegment[]): PositionIndex {
	const textToPosition = new Map<string, number[]>();
	const positionToSegment = new Map<number, PositionAwareSegment>();

	for (const segment of segments) {
		// Map positions to segments
		for (let pos = segment.from; pos < segment.to; pos++) {
			positionToSegment.set(pos, segment);
		}

		// Index text substrings (for fallback search)
		const words = segment.text.split(/\s+/);
		for (let i = 0; i < words.length; i++) {
			const word = words[i].toLowerCase();
			if (word.length > 2) {
				// Only index words longer than 2 chars
				if (!textToPosition.has(word)) {
					textToPosition.set(word, []);
				}
				textToPosition.get(word)!.push(segment.from);
			}
		}
	}

	return {
		segments,
		textToPosition,
		positionToSegment,
		version: Date.now() // Simple versioning
	};
}

/**
 * Get the path to a node at a given position
 */
function getNodePath(doc: ProseMirrorNode, pos: number): number[] {
	const path: number[] = [];
	const $pos = doc.resolve(pos);

	for (let depth = 0; depth <= $pos.depth; depth++) {
		path.push($pos.index(depth));
	}

	return path;
}

/**
 * Convert LLM's relative position to absolute document position
 */
export function relativeToAbsolute(
	segment: PositionAwareSegment,
	relativeStart: number,
	relativeEnd: number
): { from: number; to: number } {
	// The relative positions are character offsets within the segment text
	// We need to map these to absolute positions in the document

	// For text nodes, the mapping is straightforward
	if (segment.nodeType === 'text') {
		return {
			from: segment.from + relativeStart,
			to: segment.from + relativeEnd
		};
	}

	// For structural nodes (paragraph, speaker), we need to account for node boundaries
	// The +1 accounts for the opening position of the node
	return {
		from: segment.from + 1 + relativeStart,
		to: segment.from + 1 + relativeEnd
	};
}

/**
 * Validate that a position range still contains expected text
 */
export function validatePositionContent(
	doc: ProseMirrorNode,
	from: number,
	to: number,
	expectedText: string
): boolean {
	try {
		const actualText = doc.textBetween(from, to, ' ');
		// Case-insensitive comparison with whitespace normalization
		const normalizedActual = actualText.replace(/\s+/g, ' ').trim().toLowerCase();
		const normalizedExpected = expectedText.replace(/\s+/g, ' ').trim().toLowerCase();
		return normalizedActual === normalizedExpected;
	} catch (error) {
		console.error('Error validating position content:', error);
		return false;
	}
}

/**
 * Format segments for sending to LLM
 */
export function formatSegmentsForLLM(segments: PositionAwareSegment[]): Array<{
	id: string;
	text: string;
	offset: number;
	length: number;
	speaker?: string;
	context?: string;
}> {
	return segments.map((segment) => ({
		id: segment.id,
		text: segment.text,
		offset: segment.from, // Use absolute position as offset
		length: segment.text.length,
		speaker: segment.speakerName,
		context: segment.parentType
	}));
}

/**
 * Parse LLM response with position information
 */
export interface LLMPositionResponse {
	segmentId: string;
	startChar: number; // Character offset within segment
	endChar: number; // Character offset within segment
	originalText: string;
	suggestedText: string;
	confidence: number;
	type?: string;
}

/**
 * Convert LLM response to absolute positions
 */
export function llmResponseToAbsolute(
	response: LLMPositionResponse,
	segments: PositionAwareSegment[]
): {
	from: number;
	to: number;
	originalText: string;
	suggestedText: string;
	confidence: number;
} | null {
	const segment = segments.find((s) => s.id === response.segmentId);
	if (!segment) {
		console.error(`Segment ${response.segmentId} not found`);
		return null;
	}

	const { from, to } = relativeToAbsolute(segment, response.startChar, response.endChar);

	return {
		from,
		to,
		originalText: response.originalText,
		suggestedText: response.suggestedText,
		confidence: response.confidence
	};
}
