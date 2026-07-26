import { Packer } from 'docx';
import { buildTranscriptDocx } from '$lib/helpers/converters/docxFormat';
import { buildTranscriptOdt } from '$lib/helpers/converters/odtFormat';
import type { EditorDoc } from '$lib/helpers/converters/editorDoc';

export const handleSave = async (editor, fileId) => {
	const result = await fetch(`/api/files/${fileId}`, {
		method: 'PUT',
		body: JSON.stringify(editor.getJSON())
	}).catch(e=> console.error("Saving file failed", fileId))
	if (!result || !result.ok) {
		return false;
	}
	return true;
};

export const downloadHandler = (
	content: EditorDoc,
	author: string,
	title: string,
	exportNames: boolean,
	exportTimeCodes: boolean
) => {
	const doc = buildTranscriptDocx(content, {
		title,
		author,
		includeNames: exportNames,
		includeTimeCodes: exportTimeCodes
	});

	Packer.toBlob(doc).then((blob) => {
		saveBlob(blob, `${title}.docx`);
	});
};

export const downloadOdtHandler = async (
	content: EditorDoc,
	author: string,
	title: string,
	exportNames: boolean,
	exportTimeCodes: boolean
) => {
	const bytes = await buildTranscriptOdt(content, {
		title,
		author,
		includeNames: exportNames,
		includeTimeCodes: exportTimeCodes
	});

	// Copy into a fresh ArrayBuffer-backed view: a Uint8Array over a SharedArrayBuffer
	// is not a valid BlobPart, and the builder's return type does not rule that out.
	const bytesCopy = new Uint8Array(bytes.byteLength);
	bytesCopy.set(bytes);

	saveBlob(
		new Blob([bytesCopy.buffer], { type: 'application/vnd.oasis.opendocument.text' }),
		`${title}.odt`
	);
};

function saveBlob(blob: Blob, filename: string) {
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
	a.click();
	a.remove(); //afterwards we remove the element again
	window.URL.revokeObjectURL(url);
}
