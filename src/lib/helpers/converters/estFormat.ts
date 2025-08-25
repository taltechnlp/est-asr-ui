import type {
	EditorContent,
	SectionType,
	Speakers,
	Word as ApiWord,
	Turn,
	TranscriptionResult
} from '$lib/helpers/api.d';
import { v4 as uuidv4 } from 'uuid';
import type { Word, Speaker } from './types';
import { isNewFormat, fromNewEstFormat } from './newEstFormat';

const words: Array<Word> = [];
const speakers: Array<Speaker> = [];
const combineWords = (acc, word: ApiWord) => {
	const id = uuidv4().substring(36 - 12);
	words.push({ start: word.start, end: word.end, id });
	return (
		acc +
		`<span start="${word.start}" end="${word.end}" id="${id}" >${word.word_with_punctuation} </span>`
	);
};
const nameExists = (names: Array<Speaker>, name: string) => names.find((n) => n.name === name);
const mapTurns = (turn: Turn, sps: Speakers) => {
	let name = 'S1';
	if (sps && turn.speaker) {
		// Speaker is identified
		if (sps[turn.speaker] && sps[turn.speaker].name) name = sps[turn.speaker].name;
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
		id = nameExists(speakers, name).id;
	}
	speakers.push({ name, id, start: turn.start });
	return `<speaker data-name="${name}" id="${id}" >${turn.words.reduce(combineWords, '')}</speaker>`;
};

/**
 * Legacy converter for the old EST format
 */
export const fromEstFormatLegacy = (transcription: EditorContent) => {
	if (transcription && transcription.sections) {
		const tr = transcription.sections
			.reduce((acc, section) => {
				if (section.type === 'speech' && section.turns) {
					const res = acc.concat(
						section.turns.map((turn) => {
							return mapTurns(turn, transcription.speakers);
						})
					);
					return res;
				} else return acc;
			}, [])
			.join(' ');
		return {
			transcription: tr,
			words,
			speakers
		};
	} else
		return {
			transcription: '',
			words,
			speakers
		}; // Empty JSON result
};

/**
 * Universal converter that detects format and uses appropriate converter
 * Supports both legacy EST format and new TranscriptionResult format
 */
export const fromEstFormat = (input: any) => {
	// Check if it's the new TranscriptionResult format
	if (isNewFormat(input)) {
		return fromNewEstFormat(input as TranscriptionResult);
	}

	// Otherwise use legacy converter
	return fromEstFormatLegacy(input as EditorContent);
};
