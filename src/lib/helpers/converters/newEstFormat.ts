import type {
	TranscriptionResult,
	BestHypothesis,
	NewTurn,
	NewSpeaker as NewSpeakers
} from '$lib/helpers/api.d';
import { matchAlternativesToTurns } from '$lib/utils/alternativesMatching';
import type { Word, Speaker } from './types';
import { v4 as uuidv4 } from 'uuid';

const words: Array<Word> = [];
const speakers: Array<Speaker> = [];

const combineWords = (
	acc: string,
	word: { word_with_punctuation: string; start: number; end: number }
) => {
	const id = uuidv4().substring(36 - 12);
	words.push({ start: word.start, end: word.end, id });
	return (
		acc +
		`<span start="${word.start}" end="${word.end}" id="${id}">${word.word_with_punctuation} </span>`
	);
};

const nameExists = (names: Array<Speaker>, name: string) => names.find((n) => n.name === name);

const mapTurns = (turn: NewTurn, sps: NewSpeakers, alternatives: string = '') => {
	let name = 'S1';
	if (sps && turn.speaker) {
		// Speaker is identified
		if (sps[turn.speaker] && 'name' in sps[turn.speaker] && sps[turn.speaker].name) {
			name = sps[turn.speaker].name as string;
		}
		// Speaker not identified with a name
		else if (sps[turn.speaker]) name = turn.speaker;
	} else if (turn.speaker) {
		// Speakers object missing for some reason but speaker exists on the turn.
		name = turn.speaker;
	}

	let id;
	if (!nameExists(speakers, name)) {
		id = uuidv4().substring(36 - 12);
	} else {
		id = nameExists(speakers, name)!.id;
	}
	speakers.push({ name, id, start: turn.start, end: turn.end });

	// Include alternatives as an attribute if present
	const alternativesAttr = alternatives
		? ` alternatives="${alternatives.replace(/"/g, '&quot;')}"`
		: '';

	return `<speaker data-name="${name}" id="${id}"${alternativesAttr}>${turn.words.reduce(combineWords, '')}</speaker>`;
};

/**
 * Convert new TranscriptionResult format to editor format
 * @param transcriptionResult The result from new ASR pipeline with alternatives
 * @returns Editor content with alternatives embedded in speaker nodes
 */
export const fromNewEstFormat = (transcriptionResult: TranscriptionResult) => {
	// Clear previous data
	words.length = 0;
	speakers.length = 0;

	if (
		transcriptionResult &&
		transcriptionResult.best_hypothesis &&
		transcriptionResult.best_hypothesis.sections
	) {
		const bestHypothesis = transcriptionResult.best_hypothesis;
		const alternatives = transcriptionResult.alternatives;

		// Extract all turns from sections
		const allTurns: NewTurn[] = [];
		bestHypothesis.sections.forEach((section) => {
			if (section.type === 'speech' && section.turns) {
				allTurns.push(...section.turns);
			}
		});

		// Match alternatives to turns based on timing
		const matchedAlternatives = matchAlternativesToTurns(allTurns, alternatives.segments);

		const tr = bestHypothesis.sections
			.reduce((acc, section) => {
				if (section.type === 'speech' && section.turns) {
					const res = acc.concat(
						section.turns.map((turn, turnIndex) => {
							// Find matched alternatives for this turn
							const matched = matchedAlternatives.find((m) => m.turn === turn);
							const alternativesJson =
								matched && matched.alternatives.length > 0
									? JSON.stringify(matched.alternatives)
									: '';

							return mapTurns(turn, bestHypothesis.speakers, alternativesJson);
						})
					);
					return res;
				} else return acc;
			}, [] as string[])
			.join(' ');

		return {
			transcription: tr,
			words,
			speakers,
			metadata: {
				hasAlternatives: alternatives.segments.length > 0,
				language: alternatives.language,
				nBest: transcriptionResult.metadata.n_best,
				hasWordAlignments: transcriptionResult.metadata.has_word_alignments
			}
		};
	} else {
		return {
			transcription: '',
			words,
			speakers,
			metadata: {
				hasAlternatives: false,
				language: 'unknown',
				nBest: 0,
				hasWordAlignments: false
			}
		}; // Empty result
	}
};

/**
 * Detect if the input is in the new TranscriptionResult format
 */
export const isNewFormat = (input: any): input is TranscriptionResult => {
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
};

/**
 * Get alternatives for a specific segment from stored data
 * @param segmentElement DOM element or node with alternatives attribute
 * @returns Parsed alternatives or empty array
 */
export const getAlternativesFromSegment = (
	segmentElement: any
): Array<{ rank: number; text: string; avg_logprob: number }> => {
	try {
		if (segmentElement && segmentElement.attrs && segmentElement.attrs.alternatives) {
			const alternativesStr = segmentElement.attrs.alternatives;
			if (alternativesStr && alternativesStr.trim()) {
				return JSON.parse(alternativesStr);
			}
		}
		return [];
	} catch (error) {
		console.warn('Failed to parse alternatives from segment:', error);
		return [];
	}
};
