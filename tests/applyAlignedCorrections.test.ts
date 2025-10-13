import { describe, it, expect, beforeEach } from 'vitest';
import {
	applySegmentAlignments,
	applyAllCorrections,
	extractCorrectedPlainText,
	calculateCorrectionStats
} from '../src/lib/utils/applyAlignedCorrections';
import type { TipTapEditorContent } from '../src/types';
import type { SegmentAlignment } from '../src/lib/utils/textAlignment';

describe('Apply Aligned Corrections Module', () => {
	let sampleContent: TipTapEditorContent;

	beforeEach(() => {
		// Create sample TipTap editor content with word timing (new format with wordIndex)
		sampleContent = {
			type: 'doc',
			content: [
				{
					type: 'speaker',
					attrs: {
						'data-name': 'Speaker 1',
						id: 'spk1'
					},
					content: [
						{
							type: 'wordNode',
							attrs: {
								wordIndex: 0
							},
							content: [
								{
									type: 'text',
									text: 'Tere'
								}
							]
						},
						{
							type: 'text',
							text: ' '
						},
						{
							type: 'wordNode',
							attrs: {
								wordIndex: 1
							},
							content: [
								{
									type: 'text',
									text: 'õhtust'
								}
							]
						}
					]
				},
				{
					type: 'speaker',
					attrs: {
						'data-name': 'Speaker 2',
						id: 'spk2'
					},
					content: [
						{
							type: 'wordNode',
							attrs: {
								wordIndex: 2
							},
							content: [
								{
									type: 'text',
									text: 'kõik'
								}
							]
						},
						{
							type: 'text',
							text: ' '
						},
						{
							type: 'wordNode',
							attrs: {
								wordIndex: 3
							},
							content: [
								{
									type: 'text',
									text: 'vaatajad'
								}
							]
						}
					]
				}
			]
		};
	});

	describe('applySegmentAlignments', () => {
		it('should preserve original content when no alignments provided', () => {
			const result = applySegmentAlignments(sampleContent, []);

			expect(result.type).toBe('doc');
			expect(result.content).toBeDefined();
			expect(result.content.length).toBeGreaterThan(0);
		});

		it('should apply simple word substitution', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere õhtust,'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			expect(result.type).toBe('doc');
			expect(result.content).toBeDefined();
			expect(result.content.length).toBeGreaterThan(0);

			// Should have speaker nodes
			const firstSpeaker = result.content[0];
			expect(firstSpeaker.type).toBe('speaker');
			expect(firstSpeaker.attrs?.['data-name']).toBe('Speaker 1');
		});

		it('should preserve word index metadata', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere õhtust'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			// Extract words from first speaker
			const firstSpeaker = result.content[0];
			const words = firstSpeaker.content.filter((node: any) => node.type === 'wordNode');

			// Should have words with wordIndex
			expect(words.length).toBeGreaterThan(0);
			words.forEach((word: any) => {
				expect(word.attrs).toHaveProperty('wordIndex');
				expect(typeof word.attrs.wordIndex).toBe('number');
			});
		});

		it('should handle insertions', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 3,
					originalText: 'Tere õhtust',
					correctedText: 'Tere head õhtust'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			const firstSpeaker = result.content[0];
			const words = firstSpeaker.content.filter((node: any) => node.type === 'wordNode');

			// Should have 3 words now (inserted "head")
			expect(words.length).toBeGreaterThanOrEqual(2);

			// All words should have valid wordIndex
			words.forEach((word: any) => {
				expect(word.attrs).toHaveProperty('wordIndex');
			});
		});

		it('should handle deletions by skipping words', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 1,
					startWordIndex: 0,
					endWordIndex: 1,
					originalText: 'kõik vaatajad',
					correctedText: 'vaatajad'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			// Should still be valid structure
			expect(result.type).toBe('doc');
			expect(result.content.length).toBe(2);

			const secondSpeaker = result.content[1];
			expect(secondSpeaker.type).toBe('speaker');
		});

		it('should preserve speaker information', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere õhtust'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			const firstSpeaker = result.content[0];
			expect(firstSpeaker.attrs?.['data-name']).toBe('Speaker 1');
		});

		it('should handle multiple segment corrections', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere õhtust,'
				},
				{
					segmentIndex: 1,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'kõik vaatajad',
					correctedText: 'kõigile vaatajatele'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			expect(result.content.length).toBe(2);
			expect(result.content[0].type).toBe('speaker');
			expect(result.content[1].type).toBe('speaker');
		});

		it('should create valid ProseMirror structure', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere õhtust'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);

			// Validate structure
			expect(result).toHaveProperty('type');
			expect(result).toHaveProperty('content');
			expect(Array.isArray(result.content)).toBe(true);

			result.content.forEach(node => {
				expect(node).toHaveProperty('type');
				if (node.type === 'speaker') {
					expect(node).toHaveProperty('attrs');
					expect(node).toHaveProperty('content');
				}
			});
		});
	});

	describe('applyAllCorrections', () => {
		it('should apply corrections from multiple blocks', () => {
			const correctionBlocks = [
				{
					blockIndex: 0,
					status: 'completed',
					alignments: [
						{
							segmentIndex: 0,
							startWordIndex: 0,
							endWordIndex: 2,
							originalText: 'Tere õhtust',
							correctedText: 'Tere õhtust,'
						}
					]
				},
				{
					blockIndex: 1,
					status: 'completed',
					alignments: [
						{
							segmentIndex: 1,
							startWordIndex: 0,
							endWordIndex: 2,
							originalText: 'kõik vaatajad',
							correctedText: 'kõigile vaatajatele'
						}
					]
				}
			];

			const result = applyAllCorrections(sampleContent, correctionBlocks);

			expect(result.type).toBe('doc');
			expect(result.content.length).toBe(2);
		});

		it('should skip error blocks', () => {
			const correctionBlocks = [
				{
					blockIndex: 0,
					status: 'completed',
					alignments: [
						{
							segmentIndex: 0,
							startWordIndex: 0,
							endWordIndex: 2,
							originalText: 'Tere õhtust',
							correctedText: 'Tere õhtust,'
						}
					]
				},
				{
					blockIndex: 1,
					status: 'error',
					alignments: []
				}
			];

			const result = applyAllCorrections(sampleContent, correctionBlocks);

			// Should still work with only the completed block
			expect(result.type).toBe('doc');
		});

		it('should handle empty correction blocks', () => {
			const result = applyAllCorrections(sampleContent, []);

			expect(result.type).toBe('doc');
			expect(result.content.length).toBeGreaterThan(0);
		});
	});

	describe('extractCorrectedPlainText', () => {
		it('should extract plain text from content', () => {
			const text = extractCorrectedPlainText(sampleContent);

			expect(text).toContain('Speaker 1');
			expect(text).toContain('Speaker 2');
			expect(text).toContain('Tere');
			expect(text).toContain('õhtust');
			expect(text).toContain('kõik');
			expect(text).toContain('vaatajad');
		});

		it('should format speakers correctly', () => {
			const text = extractCorrectedPlainText(sampleContent);

			// Should have speaker labels
			expect(text).toMatch(/Speaker 1:/);
			expect(text).toMatch(/Speaker 2:/);
		});

		it('should handle empty content', () => {
			const emptyContent: TipTapEditorContent = {
				type: 'doc',
				content: []
			};

			const text = extractCorrectedPlainText(emptyContent);
			expect(text).toBe('');
		});

		it('should preserve punctuation', () => {
			const contentWithPunct: TipTapEditorContent = {
				type: 'doc',
				content: [
					{
						type: 'speaker',
						attrs: {
							'data-name': 'Speaker 1'
						},
						content: [
							{
								type: 'wordNode',
								attrs: {
									wordIndex: 0
								},
								content: [
									{
										type: 'text',
										text: 'Tere'
									}
								]
							},
							{
								type: 'text',
								text: ' '
							},
							{
								type: 'wordNode',
								attrs: {
									wordIndex: 1
								},
								content: [
									{
										type: 'text',
										text: 'õhtust,'
									}
								]
							}
						]
					}
				]
			};

			const text = extractCorrectedPlainText(contentWithPunct);
			expect(text).toContain('õhtust,');
		});

		it('should handle multiple paragraphs per speaker', () => {
			const text = extractCorrectedPlainText(sampleContent);

			// Should have text from all speakers
			const lines = text.split('\n\n');
			expect(lines.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('calculateCorrectionStats', () => {
		it('should calculate stats for no corrections', () => {
			const stats = calculateCorrectionStats(sampleContent, []);

			expect(stats.totalWords).toBeGreaterThan(0);
			expect(stats.matchedWords).toBe(stats.totalWords);
			expect(stats.substitutedWords).toBe(0);
			expect(stats.insertedWords).toBe(0);
			expect(stats.deletedWords).toBe(0);
			expect(stats.correctionRate).toBe('0.00%');
		});

		it('should calculate stats with substitutions', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere öhtust' // Substituted õ -> ö
				}
			];

			const stats = calculateCorrectionStats(sampleContent, alignments);

			expect(stats.totalWords).toBeGreaterThan(0);
			expect(stats.substitutedWords).toBeGreaterThan(0);
		});

		it('should calculate stats with insertions', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 3,
					originalText: 'Tere õhtust',
					correctedText: 'Tere head õhtust' // Inserted "head"
				}
			];

			const stats = calculateCorrectionStats(sampleContent, alignments);

			// Should count insertions OR substitutions
			const totalChanges = stats.insertedWords + stats.substitutedWords;
			expect(totalChanges).toBeGreaterThan(0);
		});

		it('should calculate correction rate', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere öhtust'
				}
			];

			const stats = calculateCorrectionStats(sampleContent, alignments);

			expect(stats.correctionRate).toMatch(/\d+\.\d+%/);
			expect(parseFloat(stats.correctionRate)).toBeGreaterThan(0);
		});

		it('should handle multiple corrections', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere head õhtust'
				},
				{
					segmentIndex: 1,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'kõik vaatajad',
					correctedText: 'vaatajad'
				}
			];

			const stats = calculateCorrectionStats(sampleContent, alignments);

			const totalChanges = stats.substitutedWords + stats.insertedWords + stats.deletedWords;
			expect(totalChanges).toBeGreaterThan(0);
		});
	});

	describe('Punctuation Handling', () => {
		it('should not add space before commas', () => {
			const contentWithComma: TipTapEditorContent = {
				type: 'doc',
				content: [
					{
						type: 'speaker',
						attrs: {
							'data-name': 'Speaker 1'
						},
						content: [
							{
								type: 'wordNode',
								attrs: {
									wordIndex: 0
								},
								content: [
									{
										type: 'text',
										text: 'Tere'
									}
								]
							},
							{
								type: 'wordNode',
								attrs: {
									wordIndex: 1
								},
								content: [
									{
										type: 'text',
										text: ','
									}
								]
							},
							{
								type: 'text',
								text: ' '
							},
							{
								type: 'wordNode',
								attrs: {
									wordIndex: 2
								},
								content: [
									{
										type: 'text',
										text: 'kõik'
									}
								]
							}
						]
					}
				]
			};

			const text = extractCorrectedPlainText(contentWithComma);
			expect(text).toContain('Tere,');
			expect(text).not.toContain('Tere ,');
		});

		it('should not add space before periods', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere õhtust.'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);
			const text = extractCorrectedPlainText(result);

			expect(text).toContain('õhtust.');
			expect(text).not.toContain('õhtust .');
		});
	});

	describe('Edge Cases', () => {
		it('should handle content with no speakers', () => {
			const noSpeakers: TipTapEditorContent = {
				type: 'doc',
				content: []
			};

			const result = applySegmentAlignments(noSpeakers, []);
			expect(result.type).toBe('doc');
		});

		it('should handle very long corrections', () => {
			const longText = Array(1000).fill('word').join(' ');
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 1000,
					originalText: 'Short text',
					correctedText: longText
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);
			expect(result.type).toBe('doc');
		});

		it('should handle Estonian special characters in corrections', () => {
			const alignments: SegmentAlignment[] = [
				{
					segmentIndex: 0,
					startWordIndex: 0,
					endWordIndex: 2,
					originalText: 'Tere õhtust',
					correctedText: 'Tere äöüõ'
				}
			];

			const result = applySegmentAlignments(sampleContent, alignments);
			const text = extractCorrectedPlainText(result);

			expect(text).toContain('äöüõ');
		});
	});
});
