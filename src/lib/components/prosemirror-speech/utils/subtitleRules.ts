/**
 * Subtitle segmentation rules ported from srtFormat.ts
 * Adapted for real-time editing with ProseMirror
 */

import type { Word } from './types';

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
function getFit(words: Word[], partition: number[]): number {
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
 * Split words into subtitle segments using genetic algorithm
 */
export function splitWordsIntoSegments(words: Word[]): number[] {
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
 * Determine if a break should occur at this word position
 * (simpler heuristic for real-time decision making)
 */
export function shouldBreakAtWord(
	words: Word[],
	wordIndex: number,
	currentSegmentLength: number
): boolean {
	const word = words[wordIndex];
	if (!word) return false;

	const text = word.text.trim();
	const lastChar = text[text.length - 1];

	// Hard break at sentence endings if segment is long enough (>20 chars)
	if ((lastChar === '.' || lastChar === '!' || lastChar === '?') && currentSegmentLength > 20) {
		return true;
	}

	// Break at comma if segment is getting long (>50 chars)
	if (lastChar === ',' && currentSegmentLength > 50) {
		return true;
	}

	// Force break if segment is too long (>70 chars)
	if (currentSegmentLength > 70) {
		return true;
	}

	// Check for pause after this word
	const nextWord = words[wordIndex + 1];
	if (nextWord && currentSegmentLength > 30) {
		const pause = nextWord.start - word.end;
		// Break on pauses > 0.5 seconds
		if (pause > 0.5) {
			return true;
		}
	}

	return false;
}
