/**
 * Builds an OpenDocument Text (.odt) file from a TipTap transcription.
 *
 * Like docxFormat, this stays free of browser APIs so the same builder serves
 * the editor's download and the file list's server export. JSZip runs in both
 * environments, and the returned bytes work as a Blob source or a Response body.
 *
 * An ODT is a zip whose first entry must be an uncompressed `mimetype`; the rest
 * is the flat set of XML parts below.
 */

import JSZip from 'jszip';
import { formatTimecode, turnStart, turnText, type EditorDoc } from './editorDoc';

type Options = {
	title?: string;
	author?: string;
	includeNames?: boolean;
	includeTimeCodes?: boolean;
};

const MIMETYPE = 'application/vnd.oasis.opendocument.text';

/** Escapes XML text content and drops the control characters XML 1.0 forbids. */
function xml(value: string): string {
	return value
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function paragraph(style: string, text: string): string {
	return `<text:p text:style-name="${style}">${xml(text)}</text:p>`;
}

function contentXml(doc: EditorDoc, includeNames: boolean, includeTimeCodes: boolean): string {
	const paragraphs: string[] = [];

	for (const speaker of doc?.content ?? []) {
		const text = turnText(speaker);
		if (!text) {
			continue;
		}

		if (includeNames && speaker.attrs?.['data-name']) {
			paragraphs.push(paragraph('Speaker', speaker.attrs['data-name']));
		}

		if (includeTimeCodes) {
			const start = turnStart(speaker);
			if (start !== undefined) {
				paragraphs.push(paragraph('Timecode', formatTimecode(start)));
			}
		}

		paragraphs.push(paragraph('Turn', text));
	}

	if (paragraphs.length === 0) {
		paragraphs.push(paragraph('Turn', ''));
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:body><office:text>${paragraphs.join(
		''
	)}</office:text></office:body></office:document-content>`;
}

function stylesXml(): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:styles><style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.18cm"/><style:text-properties style:font-name="Liberation Serif" fo:font-size="11pt"/></style:style><style:style style:name="Speaker" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0.35cm" fo:margin-bottom="0cm" fo:keep-with-next="always"/><style:text-properties fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"/></style:style><style:style style:name="Timecode" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="9pt" fo:font-style="italic" fo:color="#555555"/></style:style><style:style style:name="Turn" style:family="paragraph" style:parent-style-name="Standard"/></office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" style:print-orientation="portrait" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`;
}

function metaXml(title: string, author: string): string {
	const creator = author ? `<meta:initial-creator>${xml(author)}</meta:initial-creator>` : '';
	return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><dc:title>${xml(
		title
	)}</dc:title>${creator}<meta:generator>tekstiks.ee</meta:generator></office:meta></office:document-meta>`;
}

function manifestXml(): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${MIMETYPE}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
}

export async function buildTranscriptOdt(
	doc: EditorDoc,
	options: Options = {}
): Promise<Uint8Array> {
	const { title = '', author = '', includeNames = true, includeTimeCodes = false } = options;

	const zip = new JSZip();
	// Must be the first entry and stored uncompressed for readers that sniff the
	// mimetype straight out of the zip header.
	zip.file('mimetype', MIMETYPE, { compression: 'STORE' });
	zip.file('META-INF/manifest.xml', manifestXml());
	zip.file('meta.xml', metaXml(title, author));
	zip.file('styles.xml', stylesXml());
	zip.file('content.xml', contentXml(doc, includeNames, includeTimeCodes));

	return zip.generateAsync({
		type: 'uint8array',
		mimeType: MIMETYPE,
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});
}
