/**
 * Export subtitle segments to SRT format
 */

import type { SubtitleSegment, Word } from './types';

/**
 * Format timestamp for SRT format (HH:MM:SS,mmm)
 */
function formatTimestamp(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const milliseconds = Math.floor((seconds % 1) * 1000);

	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Convert a subtitle segment to SRT format
 */
export function segmentToSRT(segment: SubtitleSegment): string {
	const lines: string[] = [];

	lines.push(String(segment.index));
	lines.push(`${formatTimestamp(segment.startTime)} --> ${formatTimestamp(segment.endTime)}`);
	lines.push(segment.text);
	lines.push('');

	return lines.join('\n');
}

/**
 * Convert multiple segments to full SRT document
 */
export function segmentsToSRT(segments: SubtitleSegment[]): string {
	return segments.map((segment) => segmentToSRT(segment)).join('\n');
}

/**
 * Create a subtitle segment from words
 */
export function wordsToSegment(words: Word[], index: number): SubtitleSegment {
	if (words.length === 0) {
		throw new Error('Cannot create segment from empty words array');
	}

	const text = words.map((w) => w.text).join('').trim();
	const startTime = words[0].start;
	const endTime = words[words.length - 1].end;

	const segment: SubtitleSegment = {
		index,
		words,
		startTime,
		endTime,
		text,
		srt: ''
	};

	segment.srt = segmentToSRT(segment);

	return segment;
}
