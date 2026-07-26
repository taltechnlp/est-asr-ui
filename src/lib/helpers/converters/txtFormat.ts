/**
 * Converts a TipTap transcription document to plain text.
 */

import { formatTimecode, turnStart, turnText, type EditorDoc } from './editorDoc';

type Options = {
	includeNames?: boolean;
	includeTimeCodes?: boolean;
};

export function toPlainText(doc: EditorDoc, options: Options = {}): string {
	const { includeNames = true, includeTimeCodes = false } = options;
	const blocks: string[] = [];

	for (const speaker of doc.content ?? []) {
		const text = turnText(speaker);
		if (!text) {
			continue;
		}

		const heading: string[] = [];
		if (includeNames && speaker.attrs?.['data-name']) {
			heading.push(speaker.attrs['data-name']);
		}
		if (includeTimeCodes) {
			const start = turnStart(speaker);
			if (start !== undefined) {
				heading.push(formatTimecode(start));
			}
		}

		blocks.push(heading.length > 0 ? `${heading.join('  ')}\n${text}` : text);
	}

	return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}
