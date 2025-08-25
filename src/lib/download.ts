import { Document, Packer, Paragraph, TextRun, SectionType } from 'docx';

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

const mapSentences = (sentence: Sentence) => {
	let text = '';
	if (sentence && sentence.content) {
		text = sentence.content.reduce((sum, word) => {
			if (word.text) return sum + word.text;
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
					if (element.marks)
						element.marks.find((mark) => {
							if (mark.attrs && mark.attrs.start) {
								startTime = mark.attrs.start;
								return true;
							} else return false;
						});
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
