import type { Speaker, Word } from './types';
import { v4 as uuidv4 } from "uuid";
type InsertContent = string | { speaker: string };
type Op = {
	insert?: InsertContent;
	attributes?: {
		start?: string;
		end?: string;
		confidence?: string;
		background?: string;
	};
};

type Delta = {
	ops: Op[];
};

const nameExists = (names: Array<Speaker>, name: string) => names.find(n=>n.name===name);


const speakers: Array<Speaker> = [];
const words: Array<Word> = [];
function mapOps(op) {
	if (op.insert && typeof op.insert === 'string') {
		if (op.insert.includes('\n')) {
			return '</speaker>';
		} else {
			const id = uuidv4().substring(36 - 12);
			const start = op.attributes && op.attributes.start ? `start="${op.attributes.start}"` : null
			const end = op.attributes && op.attributes.end ? `end="${op.attributes.end}"` : null
			words.push({ id, start: parseInt(start), end: parseInt(end) })
			return `<span ${start} ${end}>${op.insert
				}</span>`;
		}
	} else if (op.insert && op.insert.speaker) {
		let id;
		if (!nameExists(speakers, op.insert.speaker)) {
			id = uuidv4().substring(36 - 12);
		}  else {
			id = nameExists(speakers, op.insert.speaker.id);
		}
		speakers.push({ name: op.insert.speaker, start: 0, id })
		return `<speaker data-name="${op.insert.speaker}" id="${id}">`
	};
};

export const fromDelta = (delta: Delta) => {
	return {
		transcription: delta.ops.map(x => mapOps(x)).join(' '),
		words,
		speakers
	}
};

export const deltaTest: Delta = {
	ops: [
		{
			insert: {
				speaker: 'Kõneleja 2'
			}
		},
		{
			attributes: {
				end: '0.09'
			},
			insert: 'See'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '0.09',
				end: '0.57'
			},
			insert: 'aasta'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '0.6',
				end: '0.75'
			},
			insert: 'kui'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '0.75',
				end: '1.11'
			},
			insert: 'Google,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '1.23',
				end: '1.71'
			},
			insert: 'Pixel'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '2.28',
				end: '2.91'
			},
			insert: 'telefonid'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '3.03',
				end: '3.42'
			},
			insert: 'väikse'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '3.57',
				end: '3.99'
			},
			insert: 'juba'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '4.35',
				end: '4.59'
			},
			insert: 'saate'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '4.59',
				end: '4.89'
			},
			insert: 'vihje'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '5.25',
				end: '5.43'
			},
			insert: 'ka'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '5.43',
				end: '5.58'
			},
			insert: 'seal'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '5.58',
				end: '5.82'
			},
			insert: 'lõpuks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '5.82',
				end: '5.88'
			},
			insert: 'see'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '5.88',
				end: '6.21'
			},
			insert: 'aasta,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '6.21',
				end: '6.36'
			},
			insert: 'kui'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '6.36',
				end: '6.69'
			},
			insert: 'Google'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '6.69',
				end: '7.26',
				confidence: '88% kindlust',
				background: '#cce8cc'
			},
			insert: 'piksli'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '7.26',
				end: '7.92'
			},
			insert: 'telefonid'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '8.28',
				end: '8.79'
			},
			insert: 'vallutavad'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '8.79',
				end: '9.12'
			},
			insert: 'maailma.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '10.54',
				end: '10.81'
			},
			insert: 'Mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '10.81',
				end: '11.08'
			},
			insert: 'ilm'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '11.08',
				end: '11.35'
			},
			insert: 'väljas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '11.35',
				end: '11.62'
			},
			insert: 'on,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '11.71',
				end: '12.22'
			},
			insert: 'selleks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '12.64',
				end: '12.85',
				confidence: '81% kindlust',
				background: '#cce8cc'
			},
			insert: 'sellele'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '12.85',
				end: '13.18'
			},
			insert: 'küsimusele'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '13.18',
				end: '13.57',
				confidence: '53% kindlust',
				background: '#ffff66'
			},
			insert: 'vastamiseks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '13.63',
				end: '13.87'
			},
			insert: 'palju'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '13.87',
				end: '14.32'
			},
			insert: 'äppe,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '14.32',
				end: '14.5'
			},
			insert: 'aga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '14.5',
				end: '14.68'
			},
			insert: 'nüüd'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '14.68',
				end: '14.8'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '14.8',
				end: '15.01'
			},
			insert: 'üks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '15.01',
				end: '15.34'
			},
			insert: 'täitsa'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '15.34',
				end: '15.79',
				confidence: '71% kindlust',
				background: '#cce8cc'
			},
			insert: 'eesti'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '15.82',
				end: '16.33'
			},
			insert: 'enda'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '16.33',
				end: '16.6'
			},
			insert: 'äpp'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '16.6',
				end: '17.14'
			},
			insert: 'selleks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '17.2',
				end: '17.71'
			},
			insert: 'ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '17.74',
				end: '18.1'
			},
			insert: 'räägime'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '18.1',
				end: '18.43'
			},
			insert: 'sellest'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '18.46',
				end: '18.76'
			},
			insert: 'mõnest'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '18.76',
				end: '19.12'
			},
			insert: 'äpist'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '19.12',
				end: '19.51'
			},
			insert: 'veel.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '20.02',
				end: '20.47'
			},
			insert: 'Jätkame'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '20.53',
				end: '20.86'
			},
			insert: 'teemat'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '20.86',
				end: '21.13'
			},
			insert: 'selles'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '21.13',
				end: '21.52'
			},
			insert: 'osas,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '21.79',
				end: '22.27'
			},
			insert: 'kuidas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '22.27',
				end: '22.57'
			},
			insert: 'siis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '22.63',
				end: '22.99'
			},
			insert: 'millise'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '22.99',
				end: '23.35'
			},
			insert: 'äpiga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '23.35',
				end: '23.92'
			},
			insert: 'tõestada,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '23.92',
				end: '24.01'
			},
			insert: 'et'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '24.01',
				end: '24.22'
			},
			insert: 'sa'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '24.22',
				end: '24.52'
			},
			insert: 'oled'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '24.67',
				end: '25.24',
				confidence: '78% kindlust',
				background: '#cce8cc'
			},
			insert: 'koroona'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '26.22',
				end: '26.67'
			},
			insert: 'suhtes'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '26.7',
				end: '27.21'
			},
			insert: 'enam-vähem'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '27.21',
				end: '27.6'
			},
			insert: 'ohutu,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '27.6',
				end: '27.78'
			},
			insert: 'kas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '27.78',
				end: '28.38'
			},
			insert: 'vaktsineeritud'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '28.38',
				end: '28.47',
				confidence: '57% kindlust',
				background: '#ffff66'
			},
			insert: 'või'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '28.47',
				end: '28.65'
			},
			insert: 'läbi'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '28.65',
				end: '29.04'
			},
			insert: 'põdenud.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '29.91',
				end: '30.15'
			},
			insert: 'Uued'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '30.15',
				end: '30.72'
			},
			insert: 'nutikellad'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '30.72',
				end: '30.99'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '31.17',
				end: '31.44'
			},
			insert: 'välja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '31.44',
				end: '31.77'
			},
			insert: 'tulnud'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '31.77',
				end: '32.01'
			},
			insert: 'ühelt'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '32.01',
				end: '32.34'
			},
			insert: 'suurelt'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '32.34',
				end: '32.91'
			},
			insert: 'tootjalt,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '33.06',
				end: '33.48'
			},
			insert: 'vaatame'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '33.48',
				end: '33.75'
			},
			insert: 'peale,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '33.75',
				end: '33.96'
			},
			insert: 'mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '33.96',
				end: '34.08'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '34.08',
				end: '34.2'
			},
			insert: 'need'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '34.23',
				end: '34.68'
			},
			insert: 'head'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '34.68',
				end: '34.74'
			},
			insert: 'ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '34.74',
				end: '34.95'
			},
			insert: 'mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '34.95',
				end: '35.1'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '35.13',
				end: '35.61'
			},
			insert: 'halb'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '35.94',
				end: '36.18'
			},
			insert: 'ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '36.18',
				end: '36.42'
			},
			insert: 'saate'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '36.42',
				end: '36.72'
			},
			insert: 'lõpuks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '36.72',
				end: '36.87'
			},
			insert: 'ma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '36.87',
				end: '37.11'
			},
			insert: 'arvan,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '37.11',
				end: '37.44'
			},
			insert: 'jõuame'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '37.44',
				end: '37.77'
			},
			insert: 'andaga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '37.77',
				end: '38.58'
			},
			insert: 'ostuhoiatuse,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '38.7',
				end: '39.15'
			},
			insert: 'aga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '39.15',
				end: '39.6'
			},
			insert: 'sellest'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '39.6',
				end: '39.96'
			},
			insert: 'kõigest'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '39.96',
				end: '40.23'
			},
			insert: 'saate'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '40.23',
				end: '40.59'
			},
			insert: 'jooksul.'
		},
		{
			insert: ' \n'
		},
		{
			insert: {
				speaker: 'Kõneleja 1'
			}
		},
		{
			attributes: {
				start: '45.26',
				end: '45.56',
				confidence: '63% kindlust',
				background: '#ffff66'
			},
			insert: 'Nonii'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '45.56',
				end: '46.04',
				confidence: '83% kindlust',
				background: '#cce8cc'
			},
			insert: 'lükkamisest'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '46.04',
				end: '46.34',
				confidence: '37% kindlust',
				background: '#ffff66'
			},
			insert: 'saat'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '46.34',
				end: '46.85'
			},
			insert: 'veerema'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '46.85',
				end: '47.9'
			},
			insert: 'digitunniteemadega'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '47.9',
				end: '48.17'
			},
			insert: 'ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '48.17',
				end: '48.59'
			},
			insert: 'võtame'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '48.59',
				end: '48.92'
			},
			insert: 'kõigepealt'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '48.92',
				end: '49.19'
			},
			insert: 'ette'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '49.19',
				end: '49.58'
			},
			insert: 'kõige'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '49.61',
				end: '50.54'
			},
			insert: 'praktilisema'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '50.54',
				end: '51.35',
				confidence: '53% kindlust',
				background: '#ffff66'
			},
			insert: 'kuumema'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '51.41',
				end: '52.22',
				confidence: '69% kindlust',
				background: '#ffff66'
			},
			insert: 'kasulikumad,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '52.22',
				end: '52.61'
			},
			insert: 'tähtsama'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '52.61',
				end: '52.94'
			},
			insert: 'teema,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '53.12',
				end: '53.87'
			},
			insert: 'vaktsineerimine'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '55.08',
				end: '55.38'
			},
			insert: 'mitte'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '55.38',
				end: '55.62'
			},
			insert: 'sellest,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '55.62',
				end: '55.77'
			},
			insert: 'kas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '55.77',
				end: '56.01'
			},
			insert: 'tuleb'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '56.01',
				end: '56.43'
			},
			insert: 'vaktsineerida'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '56.43',
				end: '56.52'
			},
			insert: 'või'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '56.52',
				end: '56.79'
			},
			insert: 'ei,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '56.85',
				end: '57.15'
			},
			insert: 'seda'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '57.15',
				end: '57.45'
			},
			insert: 'teate'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '57.45',
				end: '57.93'
			},
			insert: 'vastust'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '57.96',
				end: '58.38'
			},
			insert: 'kindlasti,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '58.38',
				end: '58.47'
			},
			insert: 'mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '58.47',
				end: '58.59'
			},
			insert: 'me'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '58.59',
				end: '58.74'
			},
			insert: 'teile'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '58.74',
				end: '59.04'
			},
			insert: 'ütleme,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '59.04',
				end: '59.25'
			},
			insert: 'aga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '59.76',
				end: '60.12'
			},
			insert: 'kuidas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '60.12',
				end: '60.27'
			},
			insert: 'siis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '60.27',
				end: '60.75'
			},
			insert: 'ikkagi'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '61.05',
				end: '61.56'
			},
			insert: 'tõestada'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '61.56',
				end: '61.77'
			},
			insert: 'seda,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '61.77',
				end: '61.86'
			},
			insert: 'et'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '61.86',
				end: '61.92'
			},
			insert: 'te'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '61.92',
				end: '62.16'
			},
			insert: 'olete'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '62.16',
				end: '62.94'
			},
			insert: 'vaktsineeritud,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '63',
				end: '63.33'
			},
			insert: 'mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '63.33',
				end: '63.69'
			},
			insert: 'muutub'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '63.69',
				end: '63.87'
			},
			insert: 'üha'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '63.87',
				end: '64.59'
			},
			insert: 'olulisemaks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '64.62',
				end: '65.16'
			},
			insert: 'nüüd'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '65.19',
				end: '65.82'
			},
			insert: 'minnes'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '65.82',
				end: '66.54',
				confidence: '79% kindlust',
				background: '#cce8cc'
			},
			insert: 'rahvarohketele'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '66.54',
				end: '67.14'
			},
			insert: 'üritustele?'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '68.08',
				end: '68.44'
			},
			insert: 'Ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '68.44',
				end: '68.77'
			},
			insert: 'eelkõige'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '68.77',
				end: '69.13'
			},
			insert: 'küsimus'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '69.13',
				end: '69.37'
			},
			insert: 'selles,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '69.37',
				end: '69.49'
			},
			insert: 'et'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '69.49',
				end: '69.73'
			},
			insert: 'kas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '69.73',
				end: '69.82'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '69.82',
				end: '70.12'
			},
			insert: 'ainuke'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '70.12',
				end: '70.54'
			},
			insert: 'võimalus'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '70.54',
				end: '70.69',
				confidence: '69% kindlust',
				background: '#ffff66'
			},
			insert: 'siis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '70.69',
				end: '71.08'
			},
			insert: 'kasutada'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '71.08',
				end: '71.35'
			},
			insert: 'sellist'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '72.79',
				end: '73.48'
			},
			insert: 'PDF-i,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '73.78',
				end: '74.44'
			},
			insert: 'mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '74.56',
				end: '74.8'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '74.8',
				end: '75.25'
			},
			insert: 'võimalik'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '75.25',
				end: '75.52'
			},
			insert: 'igal'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '75.52',
				end: '76.15',
				confidence: '50% kindlust',
				background: '#ffff66'
			},
			insert: 'vaktsineeritud'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '76.18',
				end: '76.48'
			},
			insert: 'saada'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '76.48',
				end: '76.96'
			},
			insert: 'digi'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '76.99',
				end: '77.44'
			},
			insert: 'digiloo'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '77.44',
				end: '78.07'
			},
			insert: 'portaalist'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '78.07',
				end: '78.43'
			},
			insert: 'või'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '78.43',
				end: '78.55'
			},
			insert: 'ka'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '78.55',
				end: '78.88'
			},
			insert: 'näiteks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '78.88',
				end: '79.15'
			},
			insert: 'mingit'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '79.15',
				end: '79.36'
			},
			insert: 'muud'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '79.36',
				end: '79.87'
			},
			insert: 'lahendust.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '80.4',
				end: '80.94'
			},
			insert: 'Ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '80.94',
				end: '81.33'
			},
			insert: 'eelmisel'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '81.33',
				end: '81.63'
			},
			insert: 'nädalal'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '81.63',
				end: '82.11'
			},
			insert: 'räägiti'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '82.11',
				end: '82.56'
			},
			insert: 'sellest,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '82.86',
				end: '83.34'
			},
			insert: 'et'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '83.43',
				end: '84.63'
			},
			insert: 'põhimõtteliselt'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '84.66',
				end: '85.35'
			},
			insert: 'saaks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '85.35',
				end: '86.04'
			},
			insert: 'kasutada'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '86.07',
				end: '86.43'
			},
			insert: 'selleks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '86.43',
				end: '86.55',
				confidence: '63% kindlust',
				background: '#ffff66'
			},
			insert: 'ka'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '86.55',
				end: '87.33'
			},
			insert: 'ID-kaarti.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '88.27',
				end: '88.78'
			},
			insert: 'Esiteks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '88.78',
				end: '88.9'
			},
			insert: 'ma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '88.9',
				end: '89.05'
			},
			insert: 'tahan'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '89.05',
				end: '89.2'
			},
			insert: 'kohe'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '89.2',
				end: '89.41'
			},
			insert: 'kõigile'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '89.41',
				end: '89.59'
			},
			insert: 'öelda,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '89.8',
				end: '90.07'
			},
			insert: 'äkki'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '90.07',
				end: '90.25'
			},
			insert: 'tuleb'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '90.25',
				end: '90.49'
			},
			insert: 'kõigil'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '90.52',
				end: '90.85',
				confidence: '80% kindlust',
				background: '#cce8cc'
			},
			insert: 'kellelgil'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '90.85',
				end: '91.36'
			},
			insert: 'mõtet.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '92.05',
				end: '92.23'
			},
			insert: 'Ma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '92.23',
				end: '92.5'
			},
			insert: 'näitan'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '92.5',
				end: '92.59'
			},
			insert: 'oma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '92.59',
				end: '93.34'
			},
			insert: 'isikukoodi'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '93.37',
				end: '93.52'
			},
			insert: 'ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '93.52',
				end: '93.79'
			},
			insert: 'selle'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '93.79',
				end: '94'
			},
			insert: 'järgi'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '94',
				end: '94.63'
			},
			insert: 'kontrollitakse,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '94.63',
				end: '94.75'
			},
			insert: 'kas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '94.75',
				end: '94.87'
			},
			insert: 'ma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '94.87',
				end: '94.99'
			},
			insert: 'olen'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '94.99',
				end: '95.5'
			},
			insert: 'vaktsineeritud'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '95.5',
				end: '95.62'
			},
			insert: 'või'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '95.62',
				end: '95.89'
			},
			insert: 'ei.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '96.4',
				end: '96.58'
			},
			insert: 'See'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '96.58',
				end: '96.73'
			},
			insert: 'võib'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '96.73',
				end: '97.03'
			},
			insert: 'korraks'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '97.03',
				end: '97.24'
			},
			insert: 'tundus'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '97.24',
				end: '97.45'
			},
			insert: 'väga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '97.45',
				end: '97.57'
			},
			insert: 'hea'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '97.57',
				end: '97.84'
			},
			insert: 'mõte,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '97.84',
				end: '98.08'
			},
			insert: 'aga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '98.44',
				end: '98.68'
			},
			insert: 'aga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '98.68',
				end: '99.13'
			},
			insert: 'probleem'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.13',
				end: '99.19'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.19',
				end: '99.37'
			},
			insert: 'vist'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.37',
				end: '99.64'
			},
			insert: 'selles,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.64',
				end: '99.73'
			},
			insert: 'et'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.73',
				end: '99.88'
			},
			insert: 'siis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.88',
				end: '99.97'
			},
			insert: 'ma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '99.97',
				end: '100.3'
			},
			insert: 'saaksin'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '100.3',
				end: '100.54'
			},
			insert: 'iga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '100.57',
				end: '101.05'
			},
			insert: 'isikukood'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '101.05',
				end: '101.08'
			},
			insert: 'on'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '101.08',
				end: '101.44'
			},
			insert: 'avalik'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '101.44',
				end: '101.71'
			},
			insert: 'asi,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '101.83',
				end: '102.07'
			},
			insert: 'siis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '102.07',
				end: '102.16'
			},
			insert: 'ma'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '102.16',
				end: '102.46'
			},
			insert: 'saaksin'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '102.46',
				end: '102.85'
			},
			insert: 'igaühe'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '102.85',
				end: '103.09'
			},
			insert: 'puhul'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '103.09',
				end: '103.42'
			},
			insert: 'hakata'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '103.42',
				end: '103.99'
			},
			insert: 'kontrollima,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '103.99',
				end: '104.08'
			},
			insert: 'et'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '104.08',
				end: '104.29'
			},
			insert: 'kuule,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '104.29',
				end: '104.47'
			},
			insert: 'kas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '104.47',
				end: '105.43'
			},
			insert: 'seksuaalvaktsineeritud'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '105.43',
				end: '105.55'
			},
			insert: 'ja'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.09',
				end: '106.21'
			},
			insert: 'siis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.21',
				end: '106.45'
			},
			insert: 'võib-olla'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.45',
				end: '106.48'
			},
			insert: 'ei'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.48',
				end: '106.6'
			},
			insert: 'ole'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.6',
				end: '106.84'
			},
			insert: 'päris'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.84',
				end: '106.99'
			},
			insert: 'hea'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '106.99',
				end: '107.32'
			},
			insert: 'mõte.'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '108.22',
				end: '108.49'
			},
			insert: 'Aga'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '108.49',
				end: '108.61'
			},
			insert: 'mis'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '108.61',
				end: '108.79'
			},
			insert: 'teie'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '108.79',
				end: '109.06'
			},
			insert: 'arvate,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '109.06',
				end: '109.36'
			},
			insert: 'kas,'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '109.96',
				end: '110.14'
			},
			insert: 'kas'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '110.14',
				end: '110.23'
			},
			insert: 'see'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '110.23',
				end: '110.56'
			},
			insert: 'praegune'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '110.56',
				end: '111.04'
			},
			insert: 'PDF'
		},
		{
			insert: ' '
		},
		{
			attributes: {
				start: '111.07',
				end: '111.73'
			},
			insert: 'lahendus?'
		},
		{
			insert: '\n'
		}
	]
};
