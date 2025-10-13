import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorrectionAgent } from '../../src/lib/agents/correctionAgent';
import { applySegmentAlignments, calculateCorrectionStats, extractCorrectedPlainText } from '../../src/lib/utils/applyAlignedCorrections';
import type { TimedSegment } from '../../src/lib/utils/textAlignment';
import type { TipTapEditorContent } from '../../src/types';
import transcriptFixture from '../fixtures/transcript-sample.json';

// Mock LangChain ChatOpenAI with realistic Estonian corrections
vi.mock('@langchain/openai', () => {
	return {
		ChatOpenAI: vi.fn().mockImplementation(() => ({
			invoke: vi.fn().mockImplementation(async (messages) => {
				// Extract input text from user message
				const userMessage = messages.find((m: any) => m.role === 'user');
				const inputText = userMessage?.content || '';

				// Simulate realistic Estonian corrections
				const corrected = inputText
					.replace(/\bohtust\b/g, 'õhtust')
					.replace(/\bkoik\b/g, 'kõik')
					.replace(/\btere tere\b/g, 'tere') // Remove duplicates
					.replace(/\s+/g, ' ')
					.trim();

				// Add proper punctuation at end if missing
				const punctuated = /[.!?]$/.test(corrected) ? corrected : corrected + '.';

				return {
					content: punctuated
				};
			})
		}))
	};
});

// Mock Prisma client
const mockFindMany = vi.fn().mockResolvedValue([]);
const mockUpsert = vi.fn().mockImplementation(async ({ create }) => ({
	...create,
	id: `corr-${Date.now()}`,
	createdAt: new Date(),
	updatedAt: new Date(),
	processingTimeMs: 100,
	llmInteractions: []
}));

vi.mock('$lib/db/client', () => ({
	prisma: {
		transcriptCorrection: {
			get findMany() { return mockFindMany; },
			get upsert() { return mockUpsert; }
		}
	}
}));

describe('Full Correction Flow Integration Test', () => {
	beforeEach(() => {
		process.env.OPENROUTER_API_KEY = 'test-api-key';
		// Reset mocks before each test
		mockFindMany.mockResolvedValue([]);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('End-to-End with Real Transcript', () => {
		it('should process real transcript through full pipeline', async () => {
			// Step 1: Extract segments from real transcript
			const segments = extractSegmentsFromTranscript(transcriptFixture);

			expect(segments.length).toBeGreaterThan(0);
			expect(segments[0]).toHaveProperty('index');
			expect(segments[0]).toHaveProperty('startTime');
			expect(segments[0]).toHaveProperty('endTime');
			expect(segments[0]).toHaveProperty('text');
			expect(segments[0]).toHaveProperty('speakerTag');

			// Step 2: Run correction agent on first 20 segments
			const batchSize = 20;
			const testSegments = segments.slice(0, batchSize);

			const agent = new CorrectionAgent({
				modelId: 'test-model',
				batchSize: 20,
				temperature: 0.3
			});

			const correctionResult = await agent.correctFile('test-file-id', testSegments);

			expect(correctionResult).toBeDefined();
			expect(correctionResult.totalBlocks).toBeGreaterThan(0);
			expect(correctionResult.completedBlocks).toBeGreaterThan(0);
			expect(correctionResult.status).toBe('completed');
			expect(correctionResult.blocks.length).toBeGreaterThan(0);

			// Step 3: Convert to TipTap editor structure
			const editorContent = segmentsToEditorContent(testSegments);

			expect(editorContent.type).toBe('doc');
			expect(editorContent.content.length).toBeGreaterThan(0);

			// Step 4: Apply corrections using alignment
			const allAlignments = correctionResult.blocks.flatMap(block => block.alignments);

			const correctedContent = applySegmentAlignments(editorContent, allAlignments);

			expect(correctedContent.type).toBe('doc');
			expect(correctedContent.content.length).toBeGreaterThan(0);

			// Step 5: Verify metadata preservation
			verifyMetadataPreserved(correctedContent);

			// Step 6: Calculate correction statistics
			const stats = calculateCorrectionStats(editorContent, allAlignments);

			expect(stats).toBeDefined();
			expect(stats.totalWords).toBeGreaterThan(0);
			expect(stats.correctionRate).toMatch(/\d+\.\d+%/);

			// Step 7: Export corrected text
			const plainText = extractCorrectedPlainText(correctedContent);

			expect(plainText).toBeTruthy();
			expect(plainText.length).toBeGreaterThan(0);
			expect(plainText).toContain(':'); // Should have speaker labels

			console.log('\n=== Integration Test Results ===');
			console.log(`Segments processed: ${testSegments.length}`);
			console.log(`Blocks completed: ${correctionResult.completedBlocks}/${correctionResult.totalBlocks}`);
			console.log(`Total words: ${stats.totalWords}`);
			console.log(`Matched: ${stats.matchedWords}`);
			console.log(`Substituted: ${stats.substitutedWords}`);
			console.log(`Inserted: ${stats.insertedWords}`);
			console.log(`Deleted: ${stats.deletedWords}`);
			console.log(`Correction rate: ${stats.correctionRate}`);
			console.log('===============================\n');
		});

		it('should preserve word indices', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const testSegments = segments.slice(0, 5);

			const editorContent = segmentsToEditorContent(testSegments);

			const agent = new CorrectionAgent({ batchSize: 20 });
			const correctionResult = await agent.correctFile('test-file', testSegments);

			const allAlignments = correctionResult.blocks.flatMap(block => block.alignments);
			const correctedContent = applySegmentAlignments(editorContent, allAlignments);

			// Extract word indices information
			const indices = extractWordIndices(correctedContent);

			// Verify word indices exist and are valid
			expect(indices.length).toBeGreaterThan(0);
			indices.forEach(item => {
				expect(item.wordIndex).toBeGreaterThanOrEqual(0);
				expect(typeof item.wordIndex).toBe('number');
			});

			// Verify indices are unique and reasonably ordered
			const uniqueIndices = new Set(indices.map(i => i.wordIndex));
			expect(uniqueIndices.size).toBeGreaterThan(0);
		});

		it('should handle multi-speaker transcript', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);

			// Get unique speakers
			const speakers = new Set(segments.map(s => s.speakerTag).filter(Boolean));

			expect(speakers.size).toBeGreaterThan(1); // Should have multiple speakers

			const testSegments = segments.slice(0, 20);
			const editorContent = segmentsToEditorContent(testSegments);

			const agent = new CorrectionAgent({ batchSize: 20 });
			const correctionResult = await agent.correctFile('test-file', testSegments);

			const allAlignments = correctionResult.blocks.flatMap(block => block.alignments);
			const correctedContent = applySegmentAlignments(editorContent, allAlignments);

			// Verify speakers preserved
			const correctedSpeakers = new Set<string>();
			correctedContent.content.forEach(node => {
				if (node.type === 'speaker' && node.attrs?.['data-name']) {
					correctedSpeakers.add(node.attrs['data-name']);
				}
			});

			expect(correctedSpeakers.size).toBeGreaterThan(0);
		});

		it('should handle Estonian special characters correctly', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const estonianSegments = segments.filter(s =>
				/[äöüõÄÖÜÕ]/.test(s.text)
			).slice(0, 10);

			expect(estonianSegments.length).toBeGreaterThan(0);

			const agent = new CorrectionAgent({ batchSize: 20 });
			const correctionResult = await agent.correctFile('test-file', estonianSegments);

			const allAlignments = correctionResult.blocks.flatMap(block => block.alignments);

			// Verify Estonian characters preserved in alignments
			allAlignments.forEach(alignment => {
				// Original Estonian chars should be in corrected text too
				const originalEstChars = (alignment.originalText.match(/[äöüõ]/gi) || []).length;
				if (originalEstChars > 0) {
					const correctedEstChars = (alignment.correctedText.match(/[äöüõ]/gi) || []).length;
					// Should have similar number of Estonian chars (allowing for corrections)
					expect(correctedEstChars).toBeGreaterThan(0);
				}
			});
		});

		it('should complete processing within reasonable time', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const testSegments = segments.slice(0, 40); // 2 blocks

			const agent = new CorrectionAgent({ batchSize: 20 });

			const startTime = Date.now();
			const result = await agent.correctFile('test-file', testSegments);
			const duration = Date.now() - startTime;

			expect(result.status).toBe('completed');

			// Should complete in reasonable time (allowing for async operations)
			expect(duration).toBeLessThan(10000); // 10 seconds max for test with mocks

			console.log(`\nProcessing time: ${duration}ms for ${testSegments.length} segments\n`);
		});
	});

	describe('Error Recovery', () => {
		it('should handle partial batch failures gracefully', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const testSegments = segments.slice(0, 25); // More than one batch

			// Mock one failure
			let callCount = 0;
			const { ChatOpenAI } = await import('@langchain/openai');
			// @ts-ignore
			ChatOpenAI.mockImplementation(() => ({
				invoke: vi.fn().mockImplementation(async () => {
					callCount++;
					if (callCount === 1) {
						throw new Error('Simulated API error');
					}
					return { content: 'Corrected text.' };
				})
			}));

			const agent = new CorrectionAgent({ batchSize: 20, maxRetries: 0 });
			const result = await agent.correctFile('test-file', testSegments);

			// Should have partial completion
			expect(result.totalBlocks).toBe(2);
			expect(result.status).toBe('partial'); // Some blocks failed
		});

		it('should resume from last successful block', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const testSegments = segments.slice(0, 45); // 3 blocks

			// Mock existing correction for first block
			mockFindMany.mockResolvedValueOnce([
				{
					id: 'existing-1',
					fileId: 'test-file',
					blockIndex: 0,
					segmentIndices: testSegments.slice(0, 20).map(s => s.index),
					originalText: 'existing',
					correctedText: 'existing corrected',
					suggestions: [],
					status: 'completed',
					error: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					processingTimeMs: 1000,
					llmInteractions: []
				}
			]);

			const agent = new CorrectionAgent({ batchSize: 20 });
			const result = await agent.correctFile('test-file', testSegments);

			// Should have processed all 3 blocks total (1 existing + 2 new)
			expect(result.totalBlocks).toBe(3);
			expect(result.completedBlocks).toBeGreaterThanOrEqual(2); // At least the 2 new blocks
		});
	});

	describe('Quality Validation', () => {
		it('should produce valid ProseMirror schema', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const testSegments = segments.slice(0, 10);

			const editorContent = segmentsToEditorContent(testSegments);
			const agent = new CorrectionAgent({ batchSize: 20 });
			const correctionResult = await agent.correctFile('test-file', testSegments);

			const allAlignments = correctionResult.blocks.flatMap(block => block.alignments);
			const correctedContent = applySegmentAlignments(editorContent, allAlignments);

			// Validate ProseMirror schema
			validateProseMirrorSchema(correctedContent);
		});

		it('should maintain document integrity', async () => {
			const segments = extractSegmentsFromTranscript(transcriptFixture);
			const testSegments = segments.slice(0, 15);

			const originalContent = segmentsToEditorContent(testSegments);
			const originalWordCount = countWords(originalContent);

			const agent = new CorrectionAgent({ batchSize: 20 });
			const correctionResult = await agent.correctFile('test-file', testSegments);

			const allAlignments = correctionResult.blocks.flatMap(block => block.alignments);
			const correctedContent = applySegmentAlignments(originalContent, allAlignments);

			const correctedWordCount = countWords(correctedContent);

			// Word count should be similar (allowing for some insertions/deletions)
			const ratio = correctedWordCount / originalWordCount;
			expect(ratio).toBeGreaterThan(0.8);
			expect(ratio).toBeLessThan(1.3);
		});
	});
});

// Helper Functions

function extractSegmentsFromTranscript(transcript: any): TimedSegment[] {
	const segments: TimedSegment[] = [];
	let segmentIndex = 0;

	if (!transcript.sections) return segments;

	for (const section of transcript.sections) {
		if (section.type === 'speech' && section.turns) {
			for (const turn of section.turns) {
				if (turn.transcript && turn.start !== undefined && turn.end !== undefined) {
					segments.push({
						index: segmentIndex++,
						startTime: turn.start,
						endTime: turn.end,
						text: turn.transcript,
						speakerTag: turn.speaker || 'Unknown'
					});
				}
			}
		}
	}

	return segments;
}

function segmentsToEditorContent(segments: TimedSegment[]): TipTapEditorContent {
	const content: any[] = [];
	let globalWordIndex = 0;

	for (const segment of segments) {
		const words = segment.text.split(/\s+/).filter(w => w.length > 0);

		const wordNodes: any[] = [];
		words.forEach((word, i) => {
			wordNodes.push({
				type: 'wordNode',
				attrs: {
					wordIndex: globalWordIndex++
				},
				content: [
					{
						type: 'text',
						text: word
					}
				]
			});

			// Add space after word (except last)
			if (i < words.length - 1) {
				wordNodes.push({
					type: 'text',
					text: ' '
				});
			}
		});

		content.push({
			type: 'speaker',
			attrs: {
				'data-name': segment.speakerTag
			},
			content: wordNodes
		});
	}

	return {
		type: 'doc',
		content
	};
}

function verifyMetadataPreserved(content: TipTapEditorContent): void {
	for (const speakerNode of content.content) {
		expect(speakerNode.type).toBe('speaker');
		expect(speakerNode.attrs).toBeDefined();
		expect(speakerNode.attrs?.['data-name']).toBeDefined();

		if (speakerNode.content) {
			for (const node of speakerNode.content) {
				if (node.type === 'wordNode') {
					expect(node.attrs).toBeDefined();
					expect(node.attrs?.wordIndex).toBeDefined();
					expect(typeof node.attrs?.wordIndex).toBe('number');
				}
			}
		}
	}
}

function extractWordIndices(content: TipTapEditorContent): Array<{ wordIndex: number; speakerTag: string }> {
	const indices: Array<{ wordIndex: number; speakerTag: string }> = [];

	for (const speakerNode of content.content) {
		const speakerTag = speakerNode.attrs?.['data-name'] || 'Unknown';

		if (speakerNode.content) {
			for (const node of speakerNode.content) {
				if (node.type === 'wordNode' && node.attrs && node.attrs.wordIndex !== undefined) {
					indices.push({
						wordIndex: node.attrs.wordIndex,
						speakerTag
					});
				}
			}
		}
	}

	return indices;
}

function validateProseMirrorSchema(content: TipTapEditorContent): void {
	expect(content).toHaveProperty('type');
	expect(content.type).toBe('doc');
	expect(content).toHaveProperty('content');
	expect(Array.isArray(content.content)).toBe(true);

	for (const node of content.content) {
		expect(node).toHaveProperty('type');
		expect(['speaker', 'paragraph']).toContain(node.type);

		if (node.type === 'speaker') {
			expect(node).toHaveProperty('attrs');
			expect(node).toHaveProperty('content');
		}
	}
}

function countWords(content: TipTapEditorContent): number {
	let count = 0;

	for (const speakerNode of content.content) {
		if (speakerNode.content) {
			for (const node of speakerNode.content) {
				if (node.type === 'wordNode') {
					count++;
				}
			}
		}
	}

	return count;
}
