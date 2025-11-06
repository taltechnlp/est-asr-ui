/**
 * Converts editor JSON to SRT subtitle format
 * Based on the subtitle optimization algorithm from json2srt.py
 */

type EditorWord = {
	text: string;
	start: number;
	end: number;
};

type SubtitleAndPause = [string, number];

/**
 * Feature: Penalize subtitles that are too short (<20) or too long (>70)
 */
function lengthFeature(subtitle: string, pause: number): number {
	const numCharacters = subtitle.length;
	if (numCharacters > 70) {
		return -2 * numCharacters;
	}
	if (numCharacters <= 20) {
		return (20 - numCharacters) * -1;
	}
	return numCharacters;
}

/**
 * Feature: Prefer breaks at sentence/clause endings
 */
function punctuationFeature(subtitle: string, pause: number): number {
	const lastChar = subtitle[subtitle.length - 1];
	if (lastChar === '!' || lastChar === '.' || lastChar === '?') {
		return 30;
	}
	if (lastChar === ',') {
		return 10;
	}
	return 0;
}

/**
 * Feature: Prefer breaks at longer pauses
 */
function pauseFeature(subtitle: string, pause: number): number {
	if (pause > 0) {
		return Math.max(10, 10 * pause);
	}
	return 0;
}

/**
 * Calculate total fitness score for a partition
 */
function totalFit(subtitlesAndPauses: SubtitleAndPause[]): number {
	let fit = 0;
	for (const [subtitle, pause] of subtitlesAndPauses) {
		fit += lengthFeature(subtitle, pause);
		fit += punctuationFeature(subtitle, pause);
		fit += pauseFeature(subtitle, pause);
	}
	fit -= subtitlesAndPauses.length * 10;
	return fit;
}

/**
 * Calculate score for a single subtitle candidate
 */
function scoreSubtitle(text: string, pause: number): number {
	return lengthFeature(text, pause) + punctuationFeature(text, pause) + pauseFeature(text, pause);
}

/**
 * Split words into subtitles using 3-word lookahead greedy algorithm
 * Much faster than genetic algorithm while maintaining similar quality
 */
function splitWords(words: EditorWord[]): number[] {
	if (words.length <= 10) {
		return [];
	}

	const splits: number[] = [];
	let currentStart = 0;
	const lookahead = 3; // Look ahead 3 words when deciding where to break

	while (currentStart < words.length) {
		let bestBreakPoint = currentStart + 1;
		let bestScore = -Infinity;

		// Try breaking at current+1, current+2, current+3, or current+lookahead+1
		for (let offset = 1; offset <= lookahead + 1; offset++) {
			const breakPoint = currentStart + offset;

			// Don't go past the end
			if (breakPoint >= words.length) {
				bestBreakPoint = words.length;
				break;
			}

			// Build subtitle text up to this break point
			const text = words
				.slice(currentStart, breakPoint)
				.map((w) => w.text)
				.join('')
				.trim();

			// Calculate pause after this break point
			const pause = words[breakPoint] ? words[breakPoint].start - words[breakPoint - 1].end : 0;

			// Score this break option
			const score = scoreSubtitle(text, pause);

			// Penalize very long subtitles more heavily to force breaks
			let adjustedScore = score;
			if (text.length > 70) {
				adjustedScore -= 1000; // Hard penalty for too long
			}

			if (adjustedScore > bestScore) {
				bestScore = adjustedScore;
				bestBreakPoint = breakPoint;
			}
		}

		// Add the break point (unless it's the final position)
		if (bestBreakPoint < words.length) {
			splits.push(bestBreakPoint);
		}

		currentStart = bestBreakPoint;
	}

	return splits;
}

/**
 * Format timestamp for SRT format (HH:MM:SS,mmm)
 */
function formatTimestamp(seconds: number): string {
	const date = new Date(seconds * 1000);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const milliseconds = Math.floor((seconds % 1) * 1000);

	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Extract words from editor JSON content
 */
function extractWords(content: any): EditorWord[] {
	const words: EditorWord[] = [];

	if (!content || !content.content) {
		return words;
	}

	// Iterate through speaker nodes
	for (const speakerNode of content.content) {
		if (!speakerNode.content) continue;

		// Iterate through content nodes (paragraphs/text)
		for (const contentNode of speakerNode.content) {
			if (contentNode.type === 'text' && contentNode.marks) {
				// Find the word mark
				const wordMark = contentNode.marks.find((mark: any) => mark.type === 'word');
				if (wordMark && wordMark.attrs) {
					words.push({
						text: contentNode.text || '',
						start: wordMark.attrs.start,
						end: wordMark.attrs.end
					});
				}
			}
		}
	}

	return words;
}

/**
 * Convert editor JSON to SRT format
 */
export function toSRT(editorContent: any): string {
	const words = extractWords(editorContent);

	if (words.length === 0) {
		return '';
	}

	const splitList = splitWords(words);
	const splits = [0, ...splitList, words.length];
	const srtLines: string[] = [];
	let subtitleIndex = 1;

	for (let i = 0; i < splits.length - 1; i++) {
		const subtitleWords = words.slice(splits[i], splits[i + 1]);
		// Concatenate text directly (word.text already includes trailing space)
		const text = subtitleWords.map((w) => w.text).join('').trim();
		const start = subtitleWords[0].start;
		const end = subtitleWords[subtitleWords.length - 1].end;

		srtLines.push(String(subtitleIndex));
		srtLines.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}`);
		srtLines.push(text);
		srtLines.push('');

		subtitleIndex++;
	}

	return srtLines.join('\n');
}
