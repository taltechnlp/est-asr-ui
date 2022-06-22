import { Document, Packer, Paragraph, TextRun, SectionType } from 'docx';

export const downloadHandler = (content: MyEditorContent, author, title, exportNames) => {
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
		children: [
			new TextRun(
				sentence.content.reduce((sum, word) => {
					return sum + ' ' + word.text;
				}, '')
			)
		]
	});
};

const processContent = (content, exportNames) => {
	return [
		{
			properties: {
				type: SectionType.CONTINUOUS
			},
			children: content.content.reduce((acc, val) => {
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
		text: string;
		type: string;
		marks: {
			type: string;
			attrs:{
				start: string;
				end: string;

			}
		}[];
	}[];
};

type MyEditorContent = {
	type: string;
	content: Sentence[];
};
