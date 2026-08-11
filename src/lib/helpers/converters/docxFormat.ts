/**
 * Builds a Word document from a TipTap transcription.
 *
 * Kept free of browser APIs so the same builder serves the editor's download
 * (Packer.toBlob) and the file list's server export (Packer.toBuffer).
 */

// docx is CommonJS; named ESM imports fail under Node at runtime, so
// destructure the default export and keep type-only imports separate.
import docx from 'docx';
import type { Document, Paragraph } from 'docx';
const { Document: DocxDocument, Paragraph: DocxParagraph, SectionType, TextRun } = docx;
import { formatTimecode, turnStart, turnText, type EditorDoc } from './editorDoc';

type Options = {
	title?: string;
	author?: string;
	includeNames?: boolean;
	includeTimeCodes?: boolean;
};

export function buildTranscriptDocx(doc: EditorDoc, options: Options = {}): Document {
	const { title = '', author = '', includeNames = true, includeTimeCodes = false } = options;
	const children: Paragraph[] = [];

	for (const speaker of doc?.content ?? []) {
		if (includeNames && speaker.attrs?.['data-name']) {
			children.push(new DocxParagraph({ children: [new TextRun(speaker.attrs['data-name'])] }));
		}

		if (includeTimeCodes) {
			const start = turnStart(speaker);
			if (start !== undefined) {
				children.push(new DocxParagraph({ children: [new TextRun(formatTimecode(start))] }));
			}
		}

		children.push(new DocxParagraph({ children: [new TextRun(turnText(speaker))] }));
	}

	if (children.length === 0) {
		children.push(new DocxParagraph({ children: [new TextRun('')] }));
	}

	return new DocxDocument({
		creator: author,
		title,
		sections: [
			{
				properties: { type: SectionType.CONTINUOUS },
				children
			}
		]
	});
}
