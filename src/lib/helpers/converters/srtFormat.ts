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
 * Get fitness score for a specific partition
 */
function getFit(words: EditorWord[], partition: number[]): number {
	const subtitlesAndPauses: SubtitleAndPause[] = [];
	let start = 0;

	for (const split of partition) {
		const text = words
			.slice(start, split)
			.map((w) => w.text)
			.join('')
			.trim();
		const pause = words[split + 1] ? words[split + 1].start - words[split].end : 0;
		subtitlesAndPauses.push([text, pause]);
		start = split;
	}

	const text = words
		.slice(start)
		.map((w) => w.text)
		.join('')
		.trim();
	subtitlesAndPauses.push([text, 1.0]);

	return totalFit(subtitlesAndPauses);
}

/**
 * Randomly split words into subtitles using genetic algorithm
 */
function splitWords(words: EditorWord[]): number[] {
	if (words.length <= 10) {
		return [];
	}

	let bestPartitions: [number[], number][] = [[[], getFit(words, [])]];

	const patience = 10;
	const numPrune = 20;
	const numCandidateSplits = 3;
	const numCandidateMerges = 3;
	const numCandidateShifts = 10;

	let bestScore = -100000;
	let numNoIncrease = 0;

	while (true) {
		const generatedPartitions: [number[], number][] = [...bestPartitions];

		for (const [currentPartition] of bestPartitions) {
			// Generate split candidates
			for (let i = 0; i < numCandidateSplits; i++) {
				const newSplit = Math.floor(Math.random() * (words.length - 2)) + 1;
				if (!currentPartition.includes(newSplit)) {
					const newPartition = [...currentPartition, newSplit].sort((a, b) => a - b);
					generatedPartitions.push([newPartition, getFit(words, newPartition)]);
				}
			}

			// Generate merge candidates
			for (let i = 0; i < numCandidateMerges; i++) {
				if (currentPartition.length > 1) {
					const newPartition = [...currentPartition];
					const removeIndex = Math.floor(Math.random() * newPartition.length);
					newPartition.splice(removeIndex, 1);
					generatedPartitions.push([newPartition, getFit(words, newPartition)]);
				}
			}

			// Generate shift candidates
			for (let i = 0; i < numCandidateShifts; i++) {
				if (currentPartition.length > 0) {
					const newPartition = [...currentPartition];
					const shiftIndex = Math.floor(Math.random() * newPartition.length);
					let newSplit: number;

					if (i % 2 === 0) {
						newSplit = newPartition[shiftIndex] + Math.floor(Math.random() * 3) + 1;
					} else {
						newSplit = newPartition[shiftIndex] - Math.floor(Math.random() * 3) - 1;
					}

					if (
						!newPartition.includes(newSplit) &&
						newSplit < words.length - 1 &&
						newSplit > 0
					) {
						newPartition.splice(shiftIndex, 1);
						const sortedPartition = [...newPartition, newSplit].sort((a, b) => a - b);
						generatedPartitions.push([sortedPartition, getFit(words, sortedPartition)]);
					}
				}
			}
		}

		bestPartitions = generatedPartitions.sort((a, b) => b[1] - a[1]).slice(0, numPrune);

		if (bestPartitions[0][1] > bestScore) {
			bestScore = bestPartitions[0][1];
			numNoIncrease = 0;
		} else {
			numNoIncrease += 1;
		}

		if (numNoIncrease > patience) {
			return bestPartitions[0][0];
		}
	}
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
