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
import { isNewFormat } from './newEstFormat';
import { fromNewEstFormatAI } from './newEstFormatAI';

// Create Word nodes instead of marked text
const combineWords = (words: Array<Word>) => (acc, word: ApiWord) => {
	const id = uuidv4().substring(36 - 12);
	words.push({ start: word.start, end: word.end, id });

	// Create a Word node structure instead of marked text
	return acc.concat({
		type: 'wordNode',
		attrs: {
			start: word.start,
			end: word.end,
			id: id,
			lang: 'et',
			spellcheck: 'false'
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

const mapTurns = (turn: Turn, sps: Speakers, speakers: Array<Speaker>, words: Array<Word>) => {
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
	speakers.push({ name, id, start: turn.start, end: turn.end || turn.start });

	// Build speaker node with Word nodes as content
	const wordNodes = turn.words.reduce(combineWords(words), []);

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

	return {
		type: 'speaker',
		attrs: {
			'data-name': name,
			id: id,
			topic: ''
		},
		content: contentWithSpaces
	};
};

/**
 * Legacy AI converter for the old EST format
 */
export const fromEstFormatAILegacy = (transcription: EditorContent) => {
	// Create local arrays for this conversion
	const words: Array<Word> = [];
	const speakers: Array<Speaker> = [];

	if (transcription && transcription.sections) {
		const speakerNodes = transcription.sections.reduce((acc, section) => {
			if (section.type === 'speech' && section.turns) {
				const res = acc.concat(
					section.turns.map((turn) => {
						return mapTurns(turn, transcription.speakers, speakers, words);
					})
				);
				return res;
			} else return acc;
		}, []);

		// Create proper ProseMirror document structure
		const doc = {
			type: 'doc',
			content: speakerNodes
		};

		return {
			transcription: doc,
			words,
			speakers
		};
	} else
		return {
			transcription: {
				type: 'doc',
				content: []
			},
			words,
			speakers
		}; // Empty JSON result
};

/**
 * Universal AI converter that detects format and uses appropriate converter
 * Supports both legacy EST format and new TranscriptionResult format
 */
export const fromEstFormatAI = (input: any) => {
	// Check if it's the new TranscriptionResult format
	if (isNewFormat(input)) {
		return fromNewEstFormatAI(input as TranscriptionResult);
	}

	// Otherwise use legacy AI converter
	return fromEstFormatAILegacy(input as EditorContent);
};
