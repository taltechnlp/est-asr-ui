import { Document, Packer, Paragraph, TextRun, SectionType } from 'docx';
import { testContent } from './testEditorContent';

export const downloadHandler = (content, author, title, exportNames) => {
	const doc = new Document({
		creator: author,
		title,
		sections: processContent(content, exportNames)
	});

	Packer.toBlob(doc).then((blob) => {
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'transkriptsioon.docx';
		document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
		a.click();
		a.remove(); //afterwards we remove the element again
	});
};

const mapSentences = (sentence: Sentence) => {
	return new Paragraph({
		children: [new TextRun(sentence.content.reduce((sum, word) => sum + ' ' + word.text, ''))]
	});
};

const mapSentencesWithNames = (sentence: Sentence) => {
	return new Paragraph({
		children: [new TextRun(sentence.content.reduce((sum, word) => sum + ' ' + word.text, ''))]
	});
};

const processContent = (content, exportNames) => {
	return [
		{
			properties: {
				type: SectionType.CONTINUOUS
			},
			children: testContent.content.reduce((acc, val) => {
				if (exportNames && val.attrs['data-name']) {
					acc = acc.concat(
						new Paragraph({
							children: [new TextRun(val.attrs['data-name'])]
						})
					);
				}
				return acc.concat(mapSentences(val));
			}, [])
		}
	];
};

type Sentence = {
	type: string;
	attrs: {
		'data-name': string;
		id?: string;
	};
	content: {
		type: string;
		marks: {
			type: string;
			attrs: {
				start: {
					start: string;
				};
				end: {
					end: string;
				};
			};
		}[];
		text: string;
	}[];
};

type MyEditorContent = {
	type: string;
	content: Sentence[];
};
