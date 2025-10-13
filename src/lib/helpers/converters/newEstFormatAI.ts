import type {
	TranscriptionResult,
	BestHypothesis,
	NewTurn,
	NewSpeaker as NewSpeakers
} from '$lib/helpers/api.d';
import { matchAlternativesToTurns } from '$lib/utils/alternativesMatching';
import type { Word, Speaker } from './types';
import { v4 as uuidv4 } from 'uuid';
import type { WordTiming } from '$lib/components/plugins/wordTimingPlugin';

const words: Array<Word> = [];
const speakers: Array<Speaker> = [];

// Build timing array separately from the document structure
const timingArray: WordTiming[] = [];

// Create Word nodes without timing attributes
const combineWords =
	(words: Array<Word>, timingArray: WordTiming[]) =>
	(acc: any[], word: { word_with_punctuation: string; start: number; end: number }) => {
		const id = uuidv4().substring(36 - 12);
		const wordIndex = timingArray.length;

		// Store timing in separate array
		timingArray.push({ start: word.start, end: word.end });

		// Keep legacy words array for backward compatibility (if needed)
		words.push({ start: word.start, end: word.end, id });

		// Create a simplified Word node structure with only wordIndex
		return acc.concat({
			type: 'wordNode',
			attrs: {
				wordIndex: wordIndex
			},
			content: [
				{
					type: 'text',
					text: word.word_with_punctuation
				}
			]
		});
	};

const nameExists = (names: Array<Speaker>, name: string) => names.find((n) => n.name === name);

const mapTurns = (
	turn: NewTurn,
	sps: NewSpeakers,
	speakers: Array<Speaker>,
	words: Array<Word>,
	timingArray: WordTiming[],
	alternatives: string = ''
) => {
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

	// Build speaker node with Word nodes as content (now using wordIndex)
	const wordNodes = turn.words.reduce(combineWords(words, timingArray), []);

	// Add space text nodes between words
	const contentWithSpaces = [];
	wordNodes.forEach((wordNode, index) => {
		contentWithSpaces.push(wordNode);
		if (index < wordNodes.length - 1) {
			contentWithSpaces.push({
				type: 'text',
				text: ' '
			});
		}
	});

	// Include alternatives as an attribute if present
	const speakerNodeAttrs: any = {
		'data-name': name,
		id: id,
		topic: ''
	};

	if (alternatives) {
		speakerNodeAttrs.alternatives = alternatives;
	}

	return {
		type: 'speaker',
		attrs: speakerNodeAttrs,
		content: contentWithSpaces
	};
};

/**
 * Convert new TranscriptionResult format to AI editor format with Word nodes
 * @param transcriptionResult The result from new ASR pipeline with alternatives
 * @returns Editor content with Word nodes, separate timing array, and alternatives embedded in speaker nodes
 */
export const fromNewEstFormatAI = (transcriptionResult: TranscriptionResult) => {
	// Clear previous data
	words.length = 0;
	speakers.length = 0;
	timingArray.length = 0;

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

		// Build content nodes
		const contentNodes: any[] = [];

		bestHypothesis.sections.forEach((section) => {
			if (section.type === 'speech' && section.turns) {
				section.turns.forEach((turn) => {
					// Find matched alternatives for this turn
					const matched = matchedAlternatives.find((m) => m.turn === turn);
					const alternativesJson =
						matched && matched.alternatives.length > 0 ? JSON.stringify(matched.alternatives) : '';

					const speakerNode = mapTurns(
						turn,
						bestHypothesis.speakers,
						speakers,
						words,
						timingArray,
						alternativesJson
					);
					contentNodes.push(speakerNode);
				});
			}
		});

		return {
			transcription: {
				type: 'doc',
				content: contentNodes
			},
			timingArray: [...timingArray], // Return copy of timing array
			words, // Legacy - keep for backward compatibility if needed
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
			transcription: {
				type: 'doc',
				content: []
			},
			timingArray: [],
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
