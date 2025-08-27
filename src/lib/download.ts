import { Document, Packer, Paragraph, TextRun, SectionType } from 'docx';
import type { TipTapEditorContent } from '../types';

export const handleSave = async (editor, fileId) => {
	const result = await fetch(`/api/files/${fileId}`, {
		method: 'PUT',
		body: JSON.stringify(editor.getJSON())
	}).catch((e) => console.error('Saving file failed', fileId));
	if (!result || !result.ok) {
		return false;
	}
	return true;
};

export const downloadHandler = (
	content: MyEditorContent,
	author,
	title,
	exportNames,
	exportTimeCodes
) => {
	const doc = new Document({
		creator: author,
		title,
		sections: processContent(content, exportNames, exportTimeCodes)
	});

	Packer.toBlob(doc).then((blob) => {
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${title}.docx`;
		document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
		a.click();
		a.remove(); //afterwards we remove the element again
	});
};

export const downloadTxtHandler = (
	content: TipTapEditorContent,
	title: string
) => {
	try {
		// Extract text directly from the editor content preserving original spacing
		const segments: string[] = [];
		
		if (content && content.content) {
			for (const speakerNode of content.content) {
				if (speakerNode.type === 'speaker') {
					// Extract all text content from this speaker block
					let speakerText = '';
					
					const extractTextFromNode = (node: any) => {
						// Handle text nodes (contain spaces, punctuation, etc.)
						if (node.type === 'text' && node.text) {
							speakerText += node.text;
						}
						// Handle wordNode elements (contain the actual words)
						else if (node.type === 'wordNode' && node.attrs?.text) {
							speakerText += node.attrs.text;
						}
						
						// Recursively process child nodes
						if (node.content && Array.isArray(node.content)) {
							for (const child of node.content) {
								extractTextFromNode(child);
							}
						}
					};
					
					extractTextFromNode(speakerNode);
					
					// Add this speaker's text if it's not empty
					if (speakerText.trim()) {
						segments.push(speakerText.trim());
					}
				}
			}
		}
		
		// Join all segments with line breaks (no speaker names for benchmarking)
		const plainText = segments.join('\n');

		// Create and download the text file
		const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${title}.txt`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		window.URL.revokeObjectURL(url);
	} catch (error) {
		console.error('Failed to export TXT:', error);
		alert('Failed to export as TXT. Please try again.');
	}
};

const mapSentences = (sentence: Sentence) => {
	let text = '';
	if (sentence && sentence.content) {
		text = sentence.content.reduce((sum, element) => {
			// Handle wordNode elements (AI editor format)
			if (element.type === 'wordNode' && element.attrs?.text) {
				return sum + element.attrs.text;
			}
			// Handle text elements with word marks (original format)
			else if (element.text) {
				return sum + element.text;
			}
			else return sum;
		}, '');
	}
	return new Paragraph({
		children: [new TextRun(text)]
	});
};

const processContent = (content, exportNames, exportTimeCodes) => {
	let children;
	if (content && content.content && content.content.length > 0) {
		children = content.content.reduce((acc, val) => {
			if (exportNames && val.attrs && val.attrs['data-name']) {
				acc = acc.concat(
					new Paragraph({
						children: [new TextRun(val.attrs['data-name'])]
					})
				);
			}
			if (exportTimeCodes && val.content && val.content.length > 0) {
				let startTime = undefined;
				val.content.find((element) => {
					// Handle wordNode elements (AI editor format)
					if (element.type === 'wordNode' && element.attrs?.start) {
						startTime = element.attrs.start;
						return true;
					}
					// Handle text elements with word marks (original format)
					else if (element.marks) {
						return element.marks.find((mark) => {
							if (mark.attrs && mark.attrs.start) {
								startTime = mark.attrs.start;
								return true;
							} else return false;
						});
					}
					else return false;
				});
				if (startTime) {
					const time = new Date(0);
					time.setSeconds(startTime);
					acc = acc.concat(
						new Paragraph({
							children: [
								new TextRun(
									startTime < 3600
										? time.toISOString().substr(14, 5)
										: time.toISOString().substr(11, 8)
								)
							]
						})
					);
				}
			}
			return acc.concat(mapSentences(val));
		}, []);
	} else
		children = new Paragraph({
			children: [new TextRun('')]
		});
	return [
		{
			properties: {
				type: SectionType.CONTINUOUS
			},
			children
		}
	];
};

type Sentence = {
	type?: string;
	attrs?: {
		'data-name'?: string;
		id?: string;
	};
	content?: {
		text?: string;
		type?: string;
		attrs?: {
			text?: string;
			start?: number;
			end?: number;
		};
		marks?: {
			type: string;
			attrs?: {
				start: string;
				end: string;
			};
		}[];
	}[];
};

type MyEditorContent = {
	type?: string;
	content?: Sentence[];
};
