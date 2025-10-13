import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorrectionAgent } from '../src/lib/agents/correctionAgent';
import type { TimedSegment } from '../src/lib/utils/textAlignment';

// Create mock invoke function
const mockInvoke = vi.fn().mockResolvedValue({
	content: 'Tere õhtust, kõik vaatajad!'
});

// Mock LangChain ChatOpenAI
vi.mock('@langchain/openai', () => {
	return {
		ChatOpenAI: vi.fn().mockImplementation(() => ({
			invoke: mockInvoke
		}))
	};
});

// Mock Prisma client
vi.mock('$lib/db/client', () => ({
	prisma: {
		transcriptCorrection: {
			findMany: vi.fn().mockResolvedValue([]),
			upsert: vi.fn().mockResolvedValue({
				id: 'test-id',
				fileId: 'test-file',
				blockIndex: 0,
				segmentIndices: [0],
				originalText: 'test',
				correctedText: 'test',
				suggestions: [],
				status: 'completed',
				error: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				processingTimeMs: null,
				llmInteractions: []
			})
		}
	}
}));

describe('Correction Agent Module', () => {
	let agent: CorrectionAgent;

	beforeEach(() => {
		// Set mock API key
		process.env.OPENROUTER_API_KEY = 'test-api-key';

		// Reset mock
		mockInvoke.mockClear();
		mockInvoke.mockResolvedValue({
			content: 'Tere õhtust, kõik vaatajad!'
		});

		// Create agent instance
		agent = new CorrectionAgent({
			modelId: 'test-model',
			batchSize: 20,
			maxRetries: 2,
			temperature: 0.3
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initialization', () => {
		it('should create agent with default config', () => {
			const defaultAgent = new CorrectionAgent();
			expect(defaultAgent).toBeDefined();
		});

		it('should create agent with custom config', () => {
			const customAgent = new CorrectionAgent({
				modelId: 'custom-model',
				batchSize: 15,
				maxRetries: 3,
				temperature: 0.5
			});
			expect(customAgent).toBeDefined();
		});

		it('should throw error if API key not set', () => {
			delete process.env.OPENROUTER_API_KEY;

			expect(() => {
				new CorrectionAgent();
			}).toThrow('OPENROUTER_API_KEY');

			// Restore for other tests
			process.env.OPENROUTER_API_KEY = 'test-api-key';
		});
	});

	describe('Batch Correction', () => {
		it('should correct a single batch of segments', async () => {
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

			const result = await agent.correctBatch('test-file', 0, segments);

			expect(result).toBeDefined();
			expect(result.blockIndex).toBe(0);
			expect(result.status).toBe('completed');
			expect(result.originalText).toBeDefined();
			expect(result.correctedText).toBeDefined();
			expect(result.alignments).toBeInstanceOf(Array);
		});

		it('should handle batch with segment indices', async () => {
			const segments: TimedSegment[] = [
				{
					index: 5,
					startTime: 10,
					endTime: 12.5,
					text: 'esimene segment',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await agent.correctBatch('test-file', 2, segments);

			expect(result.blockIndex).toBe(2);
			expect(result.segmentIndices).toContain(5);
		});

		it('should calculate length ratio', async () => {
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'tere õhtust',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await agent.correctBatch('test-file', 0, segments);

			expect(result.inputLength).toBe(result.originalText.length);
			expect(result.outputLength).toBe(result.correctedText.length);
			expect(result.lengthRatio).toBeGreaterThan(0);
		});
	});

	describe('Validation Logic', () => {
		it('should detect markdown contamination', async () => {
			// Mock LLM to return markdown first, then clean text
			mockInvoke
				.mockResolvedValueOnce({
					content: '```typescript\ntest code\n```'
				})
				.mockResolvedValueOnce({
					content: 'Clean text without markdown'
				});

			const testAgent = new CorrectionAgent();
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'test text',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await testAgent.correctBatch('test-file', 0, segments);

			// Should have retried due to markdown
			expect(mockInvoke).toHaveBeenCalledTimes(2);
			expect(result.retryCount).toBeGreaterThan(0);
		});

		it('should detect severe truncation', async () => {
			// Mock LLM to return very short text first, then normal text
			mockInvoke
				.mockResolvedValueOnce({
					content: 'short' // Too short compared to input
				})
				.mockResolvedValueOnce({
					content: 'This is a properly corrected text with reasonable length'
				});

			const testAgent = new CorrectionAgent({ maxRetries: 2 });
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 5.0,
					text: 'This is a very long text that should not be truncated to just a few words because that would indicate a problem with the LLM response',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await testAgent.correctBatch('test-file', 0, segments);

			// Should have retried due to truncation
			expect(mockInvoke).toHaveBeenCalledTimes(2);
		});
	});

	describe('File Correction', () => {
		it('should process file in batches', async () => {
			const segments: TimedSegment[] = Array(45).fill(null).map((_, i) => ({
				index: i,
				startTime: i * 2,
				endTime: (i + 1) * 2,
				text: `Segment ${i} text`,
				speakerTag: 'Speaker 1'
			}));

			const result = await agent.correctFile('test-file', segments);

			expect(result.totalBlocks).toBeGreaterThan(1); // Should have multiple blocks
			expect(result.completedBlocks).toBeGreaterThan(0);
			expect(result.blocks).toBeInstanceOf(Array);
			expect(result.status).toBeTruthy();
		});

		it('should calculate success rate', async () => {
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'tere õhtust',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await agent.correctFile('test-file', segments);

			expect(result.successRate).toMatch(/\d+\.\d+%/);
			expect(parseFloat(result.successRate)).toBeGreaterThanOrEqual(0);
			expect(parseFloat(result.successRate)).toBeLessThanOrEqual(100);
		});

		it('should handle empty segment list', async () => {
			const result = await agent.correctFile('test-file', []);

			expect(result.totalBlocks).toBe(0);
			expect(result.completedBlocks).toBe(0);
			expect(result.blocks).toEqual([]);
		});

		it('should resume from existing corrections', async () => {
			// Mock existing corrections
			const { prisma } = await import('$lib/db/client');
			vi.mocked(prisma.transcriptCorrection.findMany).mockResolvedValueOnce([
				{
					id: 'existing-1',
					fileId: 'test-file',
					blockIndex: 0,
					segmentIndices: [0, 1],
					originalText: 'existing text',
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

			const segments: TimedSegment[] = Array(30).fill(null).map((_, i) => ({
				index: i,
				startTime: i * 2,
				endTime: (i + 1) * 2,
				text: `Segment ${i}`,
				speakerTag: 'Speaker 1'
			}));

			const result = await agent.correctFile('test-file', segments);

			// Should have skipped block 0
			expect(result.completedBlocks).toBeGreaterThan(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle LLM API errors', async () => {
			// Mock LLM to throw error
			mockInvoke.mockRejectedValue(new Error('API Error'));

			const testAgent = new CorrectionAgent({ maxRetries: 0 });
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'test',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await testAgent.correctBatch('test-file', 0, segments);

			expect(result.status).toBe('error');
			expect(result.error).toBeDefined();
		});

		it('should retry on API errors', async () => {
			// Mock LLM to fail once then succeed
			mockInvoke
				.mockRejectedValueOnce(new Error('Temporary error'))
				.mockResolvedValueOnce({
					content: 'Corrected text'
				});

			const testAgent = new CorrectionAgent({ maxRetries: 2 });
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'test',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await testAgent.correctBatch('test-file', 0, segments);

			expect(result.status).toBe('completed');
			expect(mockInvoke).toHaveBeenCalledTimes(2);
		});

		it('should handle database errors gracefully', async () => {
			// Mock database to throw error
			const { prisma } = await import('$lib/db/client');
			vi.mocked(prisma.transcriptCorrection.upsert).mockRejectedValueOnce(
				new Error('Database error')
			);

			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'test',
					speakerTag: 'Speaker 1'
				}
			];

			// Should not throw, should handle gracefully
			const result = await agent.correctBatch('test-file', 0, segments);

			expect(result).toBeDefined();
		});
	});

	describe('Get Existing Corrections', () => {
		it('should retrieve existing corrections for a file', async () => {
			// Mock existing corrections
			const { prisma } = await import('$lib/db/client');
			vi.mocked(prisma.transcriptCorrection.findMany).mockResolvedValueOnce([
				{
					id: 'corr-1',
					fileId: 'test-file',
					blockIndex: 0,
					segmentIndices: [0, 1],
					originalText: 'original',
					correctedText: 'corrected',
					suggestions: [],
					status: 'completed',
					error: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					processingTimeMs: 1000,
					llmInteractions: []
				}
			]);

			const result = await agent.getFileCorrections('test-file');

			expect(result).not.toBeNull();
			expect(result?.blocks).toHaveLength(1);
			expect(result?.fileId).toBe('test-file');
		});

		it('should return null for file with no corrections', async () => {
			const { prisma } = await import('$lib/db/client');
			vi.mocked(prisma.transcriptCorrection.findMany).mockResolvedValueOnce([]);

			const result = await agent.getFileCorrections('no-corrections-file');

			expect(result).toBeNull();
		});
	});

	describe('Integration with Alignment', () => {
		it('should produce valid segment alignments', async () => {
			const segments: TimedSegment[] = [
				{
					index: 0,
					startTime: 0,
					endTime: 2.5,
					text: 'tere õhtust kõik',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await agent.correctBatch('test-file', 0, segments);

			expect(result.alignments).toBeInstanceOf(Array);

			// Each alignment should have required fields
			result.alignments.forEach(alignment => {
				expect(alignment).toHaveProperty('segmentIndex');
				expect(alignment).toHaveProperty('originalText');
				expect(alignment).toHaveProperty('correctedText');
				expect(alignment).toHaveProperty('startWordIndex');
				expect(alignment).toHaveProperty('endWordIndex');
			});
		});

		it('should preserve segment indices in alignments', async () => {
			const segments: TimedSegment[] = [
				{
					index: 10,
					startTime: 20,
					endTime: 22.5,
					text: 'segment text',
					speakerTag: 'Speaker 1'
				}
			];

			const result = await agent.correctBatch('test-file', 0, segments);

			expect(result.alignments[0].segmentIndex).toBe(10);
		});
	});
});
