import { describe, it, expect, beforeEach } from 'vitest';
import {
	normalizeText,
	levenshteinDistance,
	alignWords,
	alignSegments,
	calculateAlignmentMetrics,
	clearAlignmentCaches,
	type TimedSegment,
	type WordAlignment
} from '../src/lib/utils/textAlignment';

describe('Text Alignment Module', () => {
	beforeEach(() => {
		// Clear caches before each test for isolation
		clearAlignmentCaches();
	});

	describe('normalizeText', () => {
		it('should lowercase text', () => {
			expect(normalizeText('TERE ÕHTUST')).toBe('tere õhtust');
		});

		it('should collapse multiple whitespaces', () => {
			expect(normalizeText('tere    õhtust   kõik')).toBe('tere õhtust kõik');
		});

		it('should handle Estonian special characters', () => {
			expect(normalizeText('ÄÄÜÕÖÕ')).toBe('ääüõöõ');
		});

		it('should remove leading/trailing whitespace', () => {
			expect(normalizeText('  tere õhtust  ')).toBe('tere õhtust');
		});

		it('should handle empty string', () => {
			expect(normalizeText('')).toBe('');
		});

		it('should cache normalized results', () => {
			const text = 'TEST CACHE';
			const first = normalizeText(text);
			const second = normalizeText(text);
			expect(first).toBe(second);
			expect(first).toBe('test cache');
		});
	});

	describe('levenshteinDistance', () => {
		it('should calculate zero distance for identical strings', () => {
			expect(levenshteinDistance('tere', 'tere')).toBe(0);
		});

		it('should calculate distance for single substitution', () => {
			expect(levenshteinDistance('tere', 'tare')).toBe(1);
		});

		it('should calculate distance for insertion', () => {
			expect(levenshteinDistance('tere', 'teres')).toBe(1);
		});

		it('should calculate distance for deletion', () => {
			expect(levenshteinDistance('teres', 'tere')).toBe(1);
		});

		it('should calculate distance for multiple operations', () => {
			expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
		});

		it('should handle empty strings', () => {
			expect(levenshteinDistance('', 'abc')).toBe(3);
			expect(levenshteinDistance('abc', '')).toBe(3);
			expect(levenshteinDistance('', '')).toBe(0);
		});

		it('should cache distance calculations', () => {
			const dist1 = levenshteinDistance('tere', 'tare');
			const dist2 = levenshteinDistance('tere', 'tare');
			expect(dist1).toBe(dist2);
			expect(dist1).toBe(1);
		});

		it('should handle Estonian words', () => {
			expect(levenshteinDistance('õhtust', 'ohtust')).toBe(1);
		});
	});

	describe('alignWords', () => {
		it('should align identical word arrays', () => {
			const original = ['tere', 'õhtust'];
			const corrected = ['tere', 'õhtust'];
			const alignments = alignWords(original, corrected);

			expect(alignments).toHaveLength(2);
			expect(alignments[0]).toMatchObject({
				originalIndex: 0,
				correctedIndex: 0,
				operation: 'match',
				originalWord: 'tere',
				correctedWord: 'tere'
			});
			expect(alignments[1]).toMatchObject({
				originalIndex: 1,
				correctedIndex: 1,
				operation: 'match',
				originalWord: 'õhtust',
				correctedWord: 'õhtust'
			});
		});

		it('should detect substitutions', () => {
			const original = ['tere', 'öhtust'];
			const corrected = ['tere', 'õhtust'];
			const alignments = alignWords(original, corrected);

			expect(alignments).toHaveLength(2);
			expect(alignments[0].operation).toBe('match');
			expect(alignments[1]).toMatchObject({
				operation: 'substitute',
				originalWord: 'öhtust',
				correctedWord: 'õhtust'
			});
		});

		it('should detect insertions', () => {
			const original = ['tere', 'kõik'];
			const corrected = ['tere', 'õhtust', 'kõik'];
			const alignments = alignWords(original, corrected);

			expect(alignments).toHaveLength(3);
			expect(alignments[0].operation).toBe('match');
			expect(alignments[1]).toMatchObject({
				operation: 'insert',
				originalIndex: -1,
				correctedWord: 'õhtust'
			});
			expect(alignments[2].operation).toBe('match');
		});

		it('should detect deletions', () => {
			const original = ['tere', 'õhtust', 'kõik'];
			const corrected = ['tere', 'kõik'];
			const alignments = alignWords(original, corrected);

			expect(alignments).toHaveLength(3);
			expect(alignments[0].operation).toBe('match');
			expect(alignments[1]).toMatchObject({
				operation: 'delete',
				correctedIndex: -1,
				originalWord: 'õhtust'
			});
			expect(alignments[2].operation).toBe('match');
		});

		it('should handle complex edits', () => {
			const original = ['see', 'on', 'vale', 'lause'];
			const corrected = ['see', 'on', 'õige', 'tekst', 'lause'];
			const alignments = alignWords(original, corrected);

			expect(alignments.length).toBeGreaterThan(0);

			// Check that all operations are valid
			alignments.forEach(align => {
				expect(['match', 'substitute', 'insert', 'delete']).toContain(align.operation);
				if (align.operation !== 'insert') {
					expect(align.originalIndex).toBeGreaterThanOrEqual(0);
				}
				if (align.operation !== 'delete') {
					expect(align.correctedIndex).toBeGreaterThanOrEqual(0);
				}
			});
		});

		it('should handle empty arrays', () => {
			expect(alignWords([], [])).toEqual([]);

			const insertAll = alignWords([], ['tere']);
			expect(insertAll).toHaveLength(1);
			expect(insertAll[0].operation).toBe('insert');

			const deleteAll = alignWords(['tere'], []);
			expect(deleteAll).toHaveLength(1);
			expect(deleteAll[0].operation).toBe('delete');
		});

		it('should handle punctuation differences', () => {
			const original = ['tere', 'õhtust'];
			const corrected = ['tere', 'õhtust,'];
			const alignments = alignWords(original, corrected);

			// Should detect as substitution due to punctuation
			expect(alignments).toHaveLength(2);
			expect(alignments[1].operation).toBe('substitute');
		});

		it('should be case-insensitive', () => {
			const original = ['TERE', 'ÕHTUST'];
			const corrected = ['tere', 'õhtust'];
			const alignments = alignWords(original, corrected);

			// Should match because normalization makes it case-insensitive
			expect(alignments).toHaveLength(2);
			expect(alignments[0].operation).toBe('match');
			expect(alignments[1].operation).toBe('match');
		});
	});

	describe('alignSegments', () => {
		it('should align single segment with corrected text', () => {
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'tere õhtust',
					speakerTag: 'Speaker 1'
				}
			];

			const corrected = 'tere õhtust kõik';
			const alignments = alignSegments(segments, corrected);

			expect(alignments).toHaveLength(1);
			expect(alignments[0].segmentIndex).toBe(0);
			expect(alignments[0].originalText).toBe('tere õhtust');
			expect(alignments[0].correctedText).toBeTruthy();
		});

		it('should distribute words across multiple segments', () => {
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'tere õhtust',
					speakerTag: 'Speaker 1'
				},
				{
					index: 1,
					startTime: 2.5,
					endTime: 5.0,
					text: 'kõik vaatajad',
					speakerTag: 'Speaker 1'
				}
			];

			const corrected = 'tere õhtust kõigile vaatajatele';
			const alignments = alignSegments(segments, corrected);

			expect(alignments).toHaveLength(2);
			expect(alignments[0].segmentIndex).toBe(0);
			expect(alignments[1].segmentIndex).toBe(1);
		});

		it('should handle empty corrected text', () => {
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'tere õhtust',
					speakerTag: 'Speaker 1'
				}
			];

			const alignments = alignSegments(segments, '');

			expect(alignments).toHaveLength(1);
			expect(alignments[0].correctedText).toBe('');
		});

		it('should preserve segment indices', () => {
			const segments: TimedSegment[] = [
				{
					index: 5,
					startTime: 10,
					endTime: 12.5,
					text: 'esimene segment',
					speakerTag: 'Speaker 1'
				},
				{
					index: 6,
					startTime: 12.5,
					endTime: 15.0,
					text: 'teine segment',
					speakerTag: 'Speaker 2'
				}
			];

			const corrected = 'esimene osa teine osa';
			const alignments = alignSegments(segments, corrected);

			expect(alignments).toHaveLength(2);
			expect(alignments[0].segmentIndex).toBe(5);
			expect(alignments[1].segmentIndex).toBe(6);
		});
	});

	describe('calculateAlignmentMetrics', () => {
		it('should calculate metrics for perfect match', () => {
			const alignments: WordAlignment[] = [
				{ originalIndex: 0, correctedIndex: 0, operation: 'match', originalWord: 'tere', correctedWord: 'tere' },
				{ originalIndex: 1, correctedIndex: 1, operation: 'match', originalWord: 'õhtust', correctedWord: 'õhtust' }
			];

			const metrics = calculateAlignmentMetrics(alignments);

			expect(metrics.matches).toBe(2);
			expect(metrics.substitutions).toBe(0);
			expect(metrics.insertions).toBe(0);
			expect(metrics.deletions).toBe(0);
			expect(metrics.editDistance).toBe(0);
			expect(metrics.similarity).toBe(1.0);
		});

		it('should calculate metrics with substitutions', () => {
			const alignments: WordAlignment[] = [
				{ originalIndex: 0, correctedIndex: 0, operation: 'match', originalWord: 'tere', correctedWord: 'tere' },
				{ originalIndex: 1, correctedIndex: 1, operation: 'substitute', originalWord: 'öhtust', correctedWord: 'õhtust' }
			];

			const metrics = calculateAlignmentMetrics(alignments);

			expect(metrics.matches).toBe(1);
			expect(metrics.substitutions).toBe(1);
			expect(metrics.editDistance).toBe(1);
			expect(metrics.totalWords).toBe(2);
			expect(metrics.similarity).toBe(0.5);
		});

		it('should calculate metrics with insertions', () => {
			const alignments: WordAlignment[] = [
				{ originalIndex: 0, correctedIndex: 0, operation: 'match', originalWord: 'tere', correctedWord: 'tere' },
				{ originalIndex: -1, correctedIndex: 1, operation: 'insert', correctedWord: 'õhtust' },
				{ originalIndex: 1, correctedIndex: 2, operation: 'match', originalWord: 'kõik', correctedWord: 'kõik' }
			];

			const metrics = calculateAlignmentMetrics(alignments);

			expect(metrics.matches).toBe(2);
			expect(metrics.insertions).toBe(1);
			expect(metrics.editDistance).toBe(1);
			expect(metrics.totalWords).toBe(2); // Insertions don't count in total
		});

		it('should calculate metrics with deletions', () => {
			const alignments: WordAlignment[] = [
				{ originalIndex: 0, correctedIndex: 0, operation: 'match', originalWord: 'tere', correctedWord: 'tere' },
				{ originalIndex: 1, correctedIndex: -1, operation: 'delete', originalWord: 'õhtust' },
				{ originalIndex: 2, correctedIndex: 1, operation: 'match', originalWord: 'kõik', correctedWord: 'kõik' }
			];

			const metrics = calculateAlignmentMetrics(alignments);

			expect(metrics.matches).toBe(2);
			expect(metrics.deletions).toBe(1);
			expect(metrics.editDistance).toBe(1);
			expect(metrics.totalWords).toBe(3);
			expect(metrics.similarity).toBeCloseTo(0.667, 2);
		});

		it('should handle empty alignments', () => {
			const metrics = calculateAlignmentMetrics([]);

			expect(metrics.totalWords).toBe(0);
			expect(metrics.editDistance).toBe(0);
			expect(metrics.similarity).toBe(0);
		});

		it('should handle complex edits', () => {
			const alignments: WordAlignment[] = [
				{ originalIndex: 0, correctedIndex: 0, operation: 'match', originalWord: 'see', correctedWord: 'see' },
				{ originalIndex: 1, correctedIndex: 1, operation: 'substitute', originalWord: 'oli', correctedWord: 'on' },
				{ originalIndex: -1, correctedIndex: 2, operation: 'insert', correctedWord: 'väga' },
				{ originalIndex: 2, correctedIndex: 3, operation: 'match', originalWord: 'hea', correctedWord: 'hea' },
				{ originalIndex: 3, correctedIndex: -1, operation: 'delete', originalWord: 'test' }
			];

			const metrics = calculateAlignmentMetrics(alignments);

			expect(metrics.matches).toBe(2);
			expect(metrics.substitutions).toBe(1);
			expect(metrics.insertions).toBe(1);
			expect(metrics.deletions).toBe(1);
			expect(metrics.totalWords).toBe(4);
			expect(metrics.editDistance).toBe(3);
			expect(metrics.similarity).toBe(0.25);
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long word arrays efficiently', () => {
			const original = Array(100).fill('word').map((w, i) => `${w}${i}`);
			const corrected = Array(100).fill('word').map((w, i) => `${w}${i}`);

			const start = Date.now();
			const alignments = alignWords(original, corrected);
			const duration = Date.now() - start;

			expect(alignments).toHaveLength(100);
			expect(duration).toBeLessThan(100); // Should complete in under 100ms
		});

		it('should handle completely different texts', () => {
			const original = ['tere', 'öhtust', 'kõik'];
			const corrected = ['hello', 'everyone', 'here'];
			const alignments = alignWords(original, corrected);

			expect(alignments).toHaveLength(3);
			// All should be substitutions
			alignments.forEach(align => {
				expect(align.operation).toBe('substitute');
			});
		});

		it('should handle single character differences', () => {
			const original = ['a', 'b', 'c'];
			const corrected = ['a', 'x', 'c'];
			const alignments = alignWords(original, corrected);

			expect(alignments).toHaveLength(3);
			expect(alignments[0].operation).toBe('match');
			expect(alignments[1].operation).toBe('substitute');
			expect(alignments[2].operation).toBe('match');
		});
	});
});
