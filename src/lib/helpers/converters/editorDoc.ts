/**
 * Normalises a stored transcription into the TipTap document shape that every
 * export converter expects.
 *
 * A transcription on disk is in one of two shapes:
 *   1. TipTap JSON (`{ type: 'doc', content: [...] }`) — written by the editor's
 *      save (PUT /api/files/[fileId]).
 *   2. The ASR pipeline's Estonian JSON (`{ sections, speakers }`) — what a file
 *      that has never been opened in the editor still holds.
 *
 * `fromEstFormat` handles shape 2 for the editor, but it returns an HTML string
 * and accumulates into module-level arrays, so it cannot be reused on the server.
 * This module produces the node tree directly and keeps no state between calls.
 */

import { v4 as uuidv4 } from 'uuid';

export type WordMark = {
	type: 'word';
	attrs: { start: number; end: number; id: string };
};

export type TextNode = {
	type: 'text';
	text: string;
	marks?: WordMark[];
};

export type SpeakerNode = {
	type: 'speaker';
	attrs: { 'data-name': string; id: string };
	content: TextNode[];
};

export type EditorDoc = {
	type: 'doc';
	content: SpeakerNode[];
};

type PipelineWord = {
	start: number;
	end: number;
	word_with_punctuation?: string;
	word?: string;
};

type PipelineTurn = {
	speaker?: string;
	start?: number;
	end?: number;
	words?: PipelineWord[];
};

type PipelineSection = {
	type?: string;
	turns?: PipelineTurn[];
};

type PipelineTranscription = {
	sections?: PipelineSection[];
	speakers?: Record<string, { name?: string }>;
};

const shortId = () => uuidv4().substring(36 - 12);

function speakerLabel(turn: PipelineTurn, speakers: PipelineTranscription['speakers']) {
	if (!turn.speaker) {
		return 'S1';
	}
	return speakers?.[turn.speaker]?.name ?? turn.speaker;
}

function fromPipelineFormat(transcription: PipelineTranscription): EditorDoc {
	const idsByName = new Map<string, string>();
	const content: SpeakerNode[] = [];

	for (const section of transcription.sections ?? []) {
		if (section.type !== 'speech' || !section.turns) {
			continue;
		}

		for (const turn of section.turns) {
			const name = speakerLabel(turn, transcription.speakers);
			if (!idsByName.has(name)) {
				idsByName.set(name, shortId());
			}

			const words: TextNode[] = (turn.words ?? []).map((word) => ({
				type: 'text',
				// The trailing space is part of the word node in the editor's schema —
				// converters concatenate text nodes without a separator.
				text: `${word.word_with_punctuation ?? word.word ?? ''} `,
				marks: [{ type: 'word', attrs: { start: word.start, end: word.end, id: shortId() } }]
			}));

			if (words.length === 0) {
				continue;
			}

			content.push({
				type: 'speaker',
				attrs: { 'data-name': name, id: idsByName.get(name)! },
				content: words
			});
		}
	}

	return { type: 'doc', content };
}

/**
 * Accepts the raw text read from a transcription file and returns a TipTap document.
 * Throws if the text is not valid JSON.
 */
export function toEditorDoc(rawTranscription: string): EditorDoc {
	const parsed = JSON.parse(rawTranscription);

	if (parsed && typeof parsed === 'object' && parsed.type) {
		return {
			type: 'doc',
			content: Array.isArray(parsed.content) ? parsed.content : []
		};
	}

	if (parsed && typeof parsed === 'object') {
		return fromPipelineFormat(parsed as PipelineTranscription);
	}

	return { type: 'doc', content: [] };
}

/** Formats a start time the way the editor's exports do: mm:ss, or hh:mm:ss past an hour. */
export function formatTimecode(seconds: number): string {
	const time = new Date(0);
	time.setSeconds(seconds);
	return seconds < 3600 ? time.toISOString().substring(14, 19) : time.toISOString().substring(11, 19);
}

/** The start time of a speaker turn, or undefined when no word in it carries timing. */
export function turnStart(speaker: SpeakerNode): number | undefined {
	for (const node of speaker.content ?? []) {
		const mark = node.marks?.find((m) => m.type === 'word');
		if (mark?.attrs?.start !== undefined) {
			return Number(mark.attrs.start);
		}
	}
	return undefined;
}

/** The concatenated text of a speaker turn. */
export function turnText(speaker: SpeakerNode): string {
	return (speaker.content ?? []).reduce((text, node) => text + (node.text ?? ''), '').trim();
}
