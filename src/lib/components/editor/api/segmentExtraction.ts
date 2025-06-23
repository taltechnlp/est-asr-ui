import type { Editor } from '@tiptap/core';
import type { Node as ProsemirrorNode, Mark } from 'prosemirror-model';
import type { Selection } from 'prosemirror-state';

export interface TextSegment {
	id: string;
	text: string;
	start: number;
	end: number;
	speaker?: {
		id: string;
		name: string;
	};
	metadata: {
		wordCount: number;
		characterCount: number;
		hasTimestamps: boolean;
		marks: string[];
		confidence?: number;
	};
	context?: {
		previousSegment?: string;
		nextSegment?: string;
	};
}

export interface SegmentRequest {
	segments: TextSegment[];
	requestId: string;
	fileId: string;
	analysisType: 'spelling' | 'grammar' | 'punctuation' | 'context' | 'speaker' | 'comprehensive';
	language: string;
	options?: {
		includeContext?: boolean;
		maxSegmentLength?: number;
		minConfidence?: number;
		preserveTimestamps?: boolean;
	};
}

export interface SegmentResponse {
	requestId: string;
	segments: Array<{
		segmentId: string;
		suggestions: Array<{
			type: 'replace' | 'insert' | 'delete' | 'speaker_change' | 'punctuation' | 'capitalization' | 'spacing' | 'grammar' | 'context' | 'translation';
			start: number;
			end: number;
			originalText?: string;
			newText?: string;
			reason: string;
			confidence: number;
		}>;
		overallConfidence: number;
		summary: string;
	}>;
}

// Extraction strategies
export enum ExtractionStrategy {
	SELECTION = 'selection',
	PARAGRAPH = 'paragraph',
	SPEAKER_SEGMENT = 'speaker_segment',
	SLIDING_WINDOW = 'sliding_window',
	CONFIDENCE_BASED = 'confidence_based',
	MANUAL_RANGE = 'manual_range'
}

export interface ExtractionOptions {
	strategy: ExtractionStrategy;
	windowSize?: number; // For sliding window
	overlap?: number; // For sliding window
	minLength?: number;
	maxLength?: number;
	includeSpeakerInfo?: boolean;
	includeTimestamps?: boolean;
	includeMarks?: boolean;
	confidenceThreshold?: number;
	start?: number; // For manual range extraction
	end?: number; // For manual range extraction
}

/**
 * Extract text segments from the editor based on various strategies
 */
export class SegmentExtractor {
	private editor: Editor;

	constructor(editor: Editor) {
		this.editor = editor;
	}

	/**
	 * Extract segments based on current selection
	 */
	extractSelection(): TextSegment[] {
		const { selection } = this.editor.state;
		const { from, to } = selection;
		
		if (from === to) {
			return [];
		}

		const text = this.editor.state.doc.textBetween(from, to);
		const speaker = this.getSpeakerAtPosition(from);
		const metadata = this.extractMetadata(from, to);

		return [{
			id: `selection_${from}_${to}`,
			text,
			start: from,
			end: to,
			speaker,
			metadata
		}];
	}

	/**
	 * Extract segments by paragraph boundaries
	 */
	extractParagraphs(options: ExtractionOptions = { strategy: ExtractionStrategy.PARAGRAPH }): TextSegment[] {
		const segments: TextSegment[] = [];
		const { doc } = this.editor.state;

		doc.descendants((node, pos) => {
			if (node.type.name === 'paragraph' || node.type.name === 'speaker') {
				const text = node.textContent;
				
				if (text.trim() && this.meetsLengthCriteria(text, options)) {
					const speaker = this.getSpeakerAtPosition(pos);
					const metadata = this.extractMetadata(pos, pos + node.nodeSize);

					segments.push({
						id: `paragraph_${pos}_${pos + node.nodeSize}`,
						text: text.trim(),
						start: pos,
						end: pos + node.nodeSize,
						speaker,
						metadata
					});
				}
			}
		});

		return segments;
	}

	/**
	 * Extract segments by speaker boundaries
	 */
	extractSpeakerSegments(options: ExtractionOptions = { strategy: ExtractionStrategy.SPEAKER_SEGMENT }): TextSegment[] {
		const segments: TextSegment[] = [];
		const { doc } = this.editor.state;

		doc.descendants((node, pos) => {
			if (node.type.name === 'speaker') {
				const text = node.textContent;
				
				if (text.trim() && this.meetsLengthCriteria(text, options)) {
					const speaker = {
						id: node.attrs.id || 'unknown',
						name: node.attrs['data-name'] || 'Unknown Speaker'
					};
					const metadata = this.extractMetadata(pos, pos + node.nodeSize);

					segments.push({
						id: `speaker_${speaker.id}_${pos}`,
						text: text.trim(),
						start: pos,
						end: pos + node.nodeSize,
						speaker,
						metadata
					});
				}
			}
		});

		return segments;
	}

	/**
	 * Extract segments using sliding window approach
	 */
	extractSlidingWindow(options: ExtractionOptions): TextSegment[] {
		const { windowSize = 500, overlap = 100 } = options;
		const segments: TextSegment[] = [];
		const { doc } = this.editor.state;
		const fullText = doc.textContent;
		
		let start = 0;
		while (start < fullText.length) {
			const end = Math.min(start + windowSize, fullText.length);
			const text = fullText.substring(start, end);
			
			if (text.trim() && this.meetsLengthCriteria(text, options)) {
				// Find the actual positions in the document
				const startPos = this.findTextPosition(fullText, start);
				const endPos = this.findTextPosition(fullText, end);
				
				const speaker = this.getSpeakerAtPosition(startPos);
				const metadata = this.extractMetadata(startPos, endPos);

				segments.push({
					id: `window_${start}_${end}`,
					text: text.trim(),
					start: startPos,
					end: endPos,
					speaker,
					metadata
				});
			}
			
			start += (windowSize - overlap);
		}

		return segments;
	}

	/**
	 * Extract segments based on confidence scores (if available)
	 */
	extractConfidenceBased(options: ExtractionOptions): TextSegment[] {
		const { confidenceThreshold = 0.7 } = options;
		const segments: TextSegment[] = [];
		const { doc } = this.editor.state;

		// This would need to be implemented based on your confidence scoring system
		// For now, we'll extract all segments and filter by a mock confidence
		const allSegments = this.extractParagraphs(options);
		
		return allSegments.filter(segment => {
			// Mock confidence calculation - replace with actual implementation
			const mockConfidence = this.calculateMockConfidence(segment);
			return mockConfidence >= confidenceThreshold;
		});
	}

	/**
	 * Extract segments from a specific range
	 */
	extractRange(from: number, to: number): TextSegment[] {
		const text = this.editor.state.doc.textBetween(from, to);
		const speaker = this.getSpeakerAtPosition(from);
		const metadata = this.extractMetadata(from, to);

		return [{
			id: `range_${from}_${to}`,
			text,
			start: from,
			end: to,
			speaker,
			metadata
		}];
	}

	/**
	 * Main extraction method that delegates to specific strategies
	 */
	extract(options: ExtractionOptions): TextSegment[] {
		switch (options.strategy) {
			case ExtractionStrategy.SELECTION:
				return this.extractSelection();
			case ExtractionStrategy.PARAGRAPH:
				return this.extractParagraphs(options);
			case ExtractionStrategy.SPEAKER_SEGMENT:
				return this.extractSpeakerSegments(options);
			case ExtractionStrategy.SLIDING_WINDOW:
				return this.extractSlidingWindow(options);
			case ExtractionStrategy.CONFIDENCE_BASED:
				return this.extractConfidenceBased(options);
			case ExtractionStrategy.MANUAL_RANGE:
				return this.extractRange(options.start || 0, options.end || this.editor.state.doc.content.size);
			default:
				return this.extractParagraphs(options);
		}
	}

	/**
	 * Add context to segments (previous/next segments)
	 */
	addContext(segments: TextSegment[], contextSize: number = 100): TextSegment[] {
		return segments.map((segment, index) => {
			const context: { previousSegment?: string; nextSegment?: string } = {};

			// Add previous segment context
			if (index > 0) {
				const prevSegment = segments[index - 1];
				context.previousSegment = prevSegment.text.substring(-contextSize);
			}

			// Add next segment context
			if (index < segments.length - 1) {
				const nextSegment = segments[index + 1];
				context.nextSegment = nextSegment.text.substring(0, contextSize);
			}

			return {
				...segment,
				context
			};
		});
	}

	// Helper methods
	private getSpeakerAtPosition(pos: number): { id: string; name: string } | undefined {
		const { doc } = this.editor.state;
		
		// Find the speaker node that contains this position
		let speakerNode: ProsemirrorNode | null = null;
		doc.nodesBetween(pos, pos, (node, nodePos) => {
			if (node.type.name === 'speaker') {
				speakerNode = node;
				return false;
			}
		});

		if (speakerNode) {
			return {
				id: speakerNode.attrs.id || 'unknown',
				name: speakerNode.attrs['data-name'] || 'Unknown Speaker'
			};
		}

		return undefined;
	}

	private extractMetadata(start: number, end: number) {
		const { doc } = this.editor.state;
		const text = doc.textBetween(start, end);
		const marks = new Set<string>();
		let hasTimestamps = false;

		// Extract marks and check for timestamps
		doc.nodesBetween(start, end, (node) => {
			if (node.marks) {
				node.marks.forEach((mark: Mark) => {
					marks.add(mark.type.name);
					if (mark.attrs && (mark.attrs.start || mark.attrs.end)) {
						hasTimestamps = true;
					}
				});
			}
		});

		return {
			wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
			characterCount: text.length,
			hasTimestamps,
			marks: Array.from(marks),
			confidence: this.calculateMockConfidence({ text, start, end } as TextSegment)
		};
	}

	private meetsLengthCriteria(text: string, options: ExtractionOptions): boolean {
		const { minLength = 10, maxLength = 2000 } = options;
		const length = text.trim().length;
		return length >= minLength && length <= maxLength;
	}

	private findTextPosition(fullText: string, charIndex: number): number {
		// This is a simplified implementation - in practice, you'd need more sophisticated mapping
		return charIndex;
	}

	private calculateMockConfidence(segment: TextSegment): number {
		// Mock confidence calculation - replace with actual implementation
		// Could be based on word-level confidence scores, audio quality, etc.
		const baseConfidence = 0.8;
		const lengthFactor = Math.min(segment.text.length / 100, 1);
		const wordCountFactor = Math.min(segment.metadata.wordCount / 20, 1);
		
		return baseConfidence * lengthFactor * wordCountFactor;
	}
}

/**
 * Serialize segments for API transmission
 */
export class SegmentSerializer {
	/**
	 * Serialize segments to JSON format
	 */
	static toJSON(segments: TextSegment[]): string {
		return JSON.stringify(segments, null, 2);
	}

	/**
	 * Serialize segments to plain text format
	 */
	static toPlainText(segments: TextSegment[]): string {
		return segments.map(segment => {
			let text = segment.text;
			if (segment.speaker) {
				text = `[${segment.speaker.name}]: ${text}`;
			}
			return text;
		}).join('\n\n');
	}

	/**
	 * Serialize segments to structured format for LLM processing
	 */
	static toStructuredFormat(segments: TextSegment[]): any {
		return {
			segments: segments.map(segment => ({
				id: segment.id,
				text: segment.text,
				speaker: segment.speaker?.name || 'Unknown',
				metadata: {
					wordCount: segment.metadata.wordCount,
					characterCount: segment.metadata.characterCount,
					hasTimestamps: segment.metadata.hasTimestamps,
					confidence: segment.metadata.confidence
				},
				context: segment.context
			})),
			summary: {
				totalSegments: segments.length,
				totalWords: segments.reduce((sum, s) => sum + s.metadata.wordCount, 0),
				totalCharacters: segments.reduce((sum, s) => sum + s.metadata.characterCount, 0),
				speakers: [...new Set(segments.map(s => s.speaker?.name).filter(Boolean))]
			}
		};
	}
}

/**
 * API client for sending segments to LLM services
 */
export class SegmentAPIClient {
	private baseURL: string;

	constructor(baseURL: string = '/api') {
		this.baseURL = baseURL;
	}

	/**
	 * Send segments for analysis
	 */
	async analyzeSegments(request: SegmentRequest): Promise<SegmentResponse> {
		const response = await fetch(`${this.baseURL}/segment-analysis`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(request)
		});

		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Send segments for specific analysis type
	 */
	async analyzeSegmentsByType(
		segments: TextSegment[],
		analysisType: SegmentRequest['analysisType'],
		fileId: string,
		language: string = 'et',
		options?: SegmentRequest['options']
	): Promise<SegmentResponse> {
		const request: SegmentRequest = {
			segments,
			requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			fileId,
			analysisType,
			language,
			options
		};

		return this.analyzeSegments(request);
	}
} 