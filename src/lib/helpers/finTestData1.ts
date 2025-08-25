import type { FinAsrResult } from './api.d';

export const testResult: FinAsrResult = {
	done: true,
	id: '291f147f-6935-46b8-8feb-8186b3e51ec5',
	metadata: {
		version: 'KP 0.1'
	},
	processing_finished: 1664440166.831,
	processing_started: 1664440164.972,
	result: {
		sections: [
			{
				end: 3.986,
				start: 0,
				transcript: 'mit on tarkoitus tunnistaa puhetta',
				words: [
					{
						end: 0.6,
						start: 0.33,
						word: 'mit'
					},
					{
						end: 0.75,
						start: 0.611,
						word: 'on'
					},
					{
						end: 1.53,
						start: 0.78,
						word: 'tarkoitus'
					},
					{
						end: 2.4,
						start: 1.56,
						word: 'tunnistaa'
					},
					{
						end: 3.18,
						start: 2.46,
						word: 'puhetta'
					}
				]
			}
		],
		speakers: {
			S0: {}
		}
	}
};
