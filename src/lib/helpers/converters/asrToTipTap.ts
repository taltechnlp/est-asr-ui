import type { TipTapEditorContent } from '../../../types/index.js';
import type { TranscriptionResult } from '../api.d.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert ASR JSON formats to TipTap editor JSON structure
 *
 * This converter handles both:
 * 1. Legacy format: {sections: [], speakers: {}}
 * 2. New format: {best_hypothesis: {sections: [], speakers: {}}, alternatives: [], metadata: {}}
 *
 * Output is TipTap JSON that can be used by extractSpeakerSegments() and other editor utilities.
 */

interface LegacyAsrFormat {
	sections: Array<{
		type: string;
		start: number;
		end: number;
		turns?: Array<{
			start: number;
			end: number;
			speaker: string;
			transcript: string;
			unnormalized_transcript?: string;
			words: Array<{
				start: number;
				end: number;
				word: string;
				word_with_punctuation: string;
				confidence?: number;
			}>;
		}>;
	}>;
	speakers: Record<
		string,
		{
			name: string;
		}
	>;
}

/**
 * Detect if the input is in the new TranscriptionResult format
 */
function isNewFormat(input: any): input is TranscriptionResult {
	return (
		input &&
		typeof input === 'object' &&
		'best_hypothesis' in input &&
		'alternatives' in input &&
		'metadata' in input &&
		input.best_hypothesis &&
		typeof input.best_hypothesis === 'object' &&
		'sections' in input.best_hypothesis
	);
}

/**
 * Generate a short unique ID for nodes (12 characters)
 */
function generateId(): string {
	return uuidv4().substring(24);
}

/**
 * Convert legacy ASR format to TipTap JSON
 */
function convertLegacyAsrToTipTap(asrData: LegacyAsrFormat): TipTapEditorContent {
	const content: any[] = [];
	const sections = asrData.sections || [];
	const speakers = asrData.speakers || {};

	for (const section of sections) {
		// Only process speech sections with turns
		if (section.type !== 'speech' || !section.turns) {
			continue;
		}

		for (const turn of section.turns) {
			const speakerTag = turn.speaker;
			const speakerName = speakers[speakerTag]?.name || speakerTag;
			const words = turn.words || [];

			// Skip turns with no words
			if (words.length === 0) {
				continue;
			}

			// Create text nodes with word marks for each word
			const wordNodes: any[] = [];
			for (const word of words) {
				// Get word text (prefer punctuated version)
				const wordText = word.word_with_punctuation || word.word || '';

				// Skip empty words
				if (!wordText.trim()) {
					continue;
				}

				wordNodes.push({
					type: 'text',
					text: wordText + ' ', // Add space after each word
					marks: [
						{
							type: 'word',
							attrs: {
								start: word.start,
								end: word.end,
								id: generateId()
							}
						}
					]
				});
			}

			// Only create speaker node if we have word nodes
			if (wordNodes.length > 0) {
				content.push({
					type: 'speaker',
					attrs: {
						'data-name': speakerName,
						id: generateId()
					},
					content: wordNodes
				});
			}
		}
	}

	return {
		type: 'doc',
		content
	};
}

/**
 * Convert new ASR format to TipTap JSON
 */
function convertNewAsrToTipTap(asrData: TranscriptionResult): TipTapEditorContent {
	const content: any[] = [];
	const bestHypothesis = asrData.best_hypothesis;
	const sections = bestHypothesis.sections || [];
	const speakers = bestHypothesis.speakers || {};

	for (const section of sections) {
		// Only process speech sections with turns
		if (section.type !== 'speech' || !section.turns) {
			continue;
		}

		for (const turn of section.turns) {
			const speakerTag = turn.speaker;
			const speakerName = speakers[speakerTag]?.name || speakerTag;
			const words = turn.words || [];

			// Skip turns with no words
			if (words.length === 0) {
				continue;
			}

			// Create text nodes with word marks for each word
			const wordNodes: any[] = [];
			for (const word of words) {
				// Get word text (prefer punctuated version)
				const wordText = word.word_with_punctuation || word.word || '';

				// Skip empty words
				if (!wordText.trim()) {
					continue;
				}

				wordNodes.push({
					type: 'text',
					text: wordText + ' ', // Add space after each word
					marks: [
						{
							type: 'word',
							attrs: {
								start: word.start,
								end: word.end,
								id: generateId()
							}
						}
					]
				});
			}

			// Only create speaker node if we have word nodes
			if (wordNodes.length > 0) {
				// For new format, try to include alternatives if available
				// (alternatives matching would be done separately if needed)
				const speakerAttrs: any = {
					'data-name': speakerName,
					id: generateId()
				};

				content.push({
					type: 'speaker',
					attrs: speakerAttrs,
					content: wordNodes
				});
			}
		}
	}

	return {
		type: 'doc',
		content
	};
}

/**
 * Main conversion function - detects format and converts to TipTap JSON
 *
 * @param asrData - Raw ASR JSON in either legacy or new format
 * @returns TipTap editor JSON structure
 */
export function convertAsrToTipTapJson(asrData: any): TipTapEditorContent {
	if (!asrData) {
		return { type: 'doc', content: [] };
	}

	// Detect format and convert accordingly
	if (isNewFormat(asrData)) {
		return convertNewAsrToTipTap(asrData);
	} else if (asrData.sections && Array.isArray(asrData.sections)) {
		// Legacy format
		return convertLegacyAsrToTipTap(asrData as LegacyAsrFormat);
	} else {
		// Unknown format - return empty document
		console.warn('[convertAsrToTipTapJson] Unknown ASR format, returning empty document');
		return { type: 'doc', content: [] };
	}
}
