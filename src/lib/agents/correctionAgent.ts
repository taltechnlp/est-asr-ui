/**
 * Correction Agent for ASR Transcript Correction
 *
 * Simple agent that corrects Estonian ASR transcripts using LLM.
 * Based on agno-agent's baseline_agent.py approach.
 *
 * Key principles:
 * - Process transcripts in batches of ~20 segments
 * - LLM corrects plain text (not structured JSON) for best performance
 * - Validation and retry logic for robust correction
 * - Block-based processing for resume capability
 */

import { ChatOpenAI } from '@langchain/openai';
import { prisma } from '$lib/db/client';
import type { TimedSegment, SegmentAlignment } from '$lib/utils/textAlignment';
import { alignSegments } from '$lib/utils/textAlignment';

/**
 * Configuration for the correction agent
 */
export interface CorrectionAgentConfig {
	modelId?: string;
	batchSize?: number;
	maxRetries?: number;
	temperature?: number;
}

/**
 * Result from correcting a single batch
 */
export interface BatchCorrectionResult {
	blockIndex: number;
	segmentIndices: number[];
	originalText: string;
	correctedText: string;
	alignments: SegmentAlignment[];
	status: 'completed' | 'error';
	error?: string;
	validationIssues?: string[];
	retryCount?: number;
	inputLength: number;
	outputLength: number;
	lengthRatio: number;
}

/**
 * Result from correcting an entire file
 */
export interface FileCorrectionResult {
	fileId: string;
	totalBlocks: number;
	completedBlocks: number;
	successRate: string;
	blocks: BatchCorrectionResult[];
	status: 'completed' | 'partial' | 'error';
	error?: string;
}

/**
 * Get the correction prompt adapted from baseline_agent.py
 */
function getCorrectionPrompt(): string {
	return `You are tasked with correcting Estonian ASR (automatic speech recognition) transcripts.

Follow these instructions carefully:

1) Correct the text, paying attention to:
   - Estonian spelling, punctuation, and grammar
   - Correct punctuation for direct speech
   - Correct any hallucinations or repeated text (e.g., unnecessary repetitions)
   - Proper capitalization of sentences and proper nouns

2) IMPORTANT CONSTRAINTS:
   - Do NOT add significant new content that wasn't in the original
   - Do NOT change the overall meaning or structure
   - Only correct obvious errors, spelling mistakes, and grammatical issues
   - Preserve the natural flow and style of spoken Estonian

3) OUTPUT FORMAT:
   - Respond ONLY with the corrected text
   - Do not add any explanations, comments, or additional text
   - Maintain the original paragraph structure where sensible

You must respond ONLY with the corrected text. Do not add any additional comments.`;
}

/**
 * Correction Agent class
 */
export class CorrectionAgent {
	private model: ChatOpenAI;
	private batchSize: number;
	private maxRetries: number;
	private systemPrompt: string;

	constructor(config: CorrectionAgentConfig = {}) {
		const {
			modelId = 'anthropic/claude-3.5-sonnet',
			batchSize = 20,
			maxRetries = 2,
			temperature = 0.3
		} = config;

		this.batchSize = batchSize;
		this.maxRetries = maxRetries;
		this.systemPrompt = getCorrectionPrompt();

		// Get API key from environment
		const apiKey = process.env.OPENROUTER_API_KEY || '';
		if (!apiKey) {
			throw new Error('OPENROUTER_API_KEY environment variable is not set');
		}

		// Initialize ChatOpenAI with OpenRouter
		this.model = new ChatOpenAI({
			modelName: modelId,
			temperature,
			maxTokens: 16384,
			configuration: {
				baseURL: 'https://openrouter.ai/api/v1',
				apiKey,
				defaultHeaders: {
					'HTTP-Referer': 'https://tekstiks.ee',
					'X-Title': 'Tekstiks ASR Correction'
				}
			}
		});

		console.log(`[CorrectionAgent] Initialized with model: ${modelId}, batch size: ${batchSize}`);
	}

	/**
	 * Validate LLM output for common issues
	 */
	private validateOutput(
		inputText: string,
		outputText: string,
		retryCount: number
	): { valid: boolean; issues: string[] } {
		const issues: string[] = [];

		const inputLength = inputText.length;
		const outputLength = outputText.length;
		const lengthRatio = inputLength > 0 ? outputLength / inputLength : 0;

		// Check for markdown contamination
		if (outputText.includes('```') || outputText.includes('**') || outputText.startsWith('#')) {
			issues.push('Markdown formatting detected in output');
		}

		// Check for severe content loss (likely truncation)
		if (lengthRatio < 0.8) {
			issues.push(
				`Severe content loss detected (${(lengthRatio * 100).toFixed(1)}% of original length)`
			);
		}

		// Check for suspiciously short output
		if (outputLength < 200 && inputLength > 1000) {
			issues.push(`Suspiciously short output (${outputLength} chars from ${inputLength} chars input)`);
		}

		// Check for excessive content gain
		if (lengthRatio > 1.15) {
			issues.push(
				`Significant length increase detected (${(lengthRatio * 100).toFixed(1)}% of original)`
			);
		}

		// Log validation results
		if (issues.length > 0) {
			console.warn(
				`[CorrectionAgent] Validation issues (retry ${retryCount}/${this.maxRetries}):`,
				issues.join(', ')
			);
		}

		// Only retry for severe issues
		const shouldRetry = retryCount < this.maxRetries && (
			lengthRatio < 0.8 ||
			outputText.includes('```') ||
			(outputLength < 200 && inputLength > 1000)
		);

		return {
			valid: !shouldRetry,
			issues
		};
	}

	/**
	 * Process a single batch of segments with retry logic
	 */
	private async processBatch(
		batchText: string,
		retryCount: number = 0
	): Promise<{ correctedText: string; validationIssues?: string[]; retryCount: number }> {
		console.log(
			`[CorrectionAgent] Processing batch (${batchText.length} chars, retry ${retryCount}/${this.maxRetries})`
		);

		try {
			// Call LLM with system prompt and user message
			const response = await this.model.invoke([
				{ role: 'system', content: this.systemPrompt },
				{ role: 'user', content: batchText }
			]);

			const correctedText = response.content.toString().trim();

			// Validate output
			const validation = this.validateOutput(batchText, correctedText, retryCount);

			if (!validation.valid && retryCount < this.maxRetries) {
				// Retry on validation failure
				console.warn(
					`[CorrectionAgent] Retrying batch due to validation failures (attempt ${retryCount + 1}/${this.maxRetries})`
				);

				// Add small delay before retry
				await new Promise(resolve => setTimeout(resolve, 1000));

				return this.processBatch(batchText, retryCount + 1);
			}

			return {
				correctedText,
				validationIssues: validation.issues.length > 0 ? validation.issues : undefined,
				retryCount
			};
		} catch (error) {
			console.error(`[CorrectionAgent] Error processing batch (retry ${retryCount}):`, error);

			if (retryCount < this.maxRetries) {
				console.log(`[CorrectionAgent] Retrying after error (attempt ${retryCount + 1}/${this.maxRetries})`);
				await new Promise(resolve => setTimeout(resolve, 2000));
				return this.processBatch(batchText, retryCount + 1);
			}

			throw error;
		}
	}

	/**
	 * Correct a batch of segments
	 */
	async correctBatch(
		fileId: string,
		blockIndex: number,
		segments: TimedSegment[]
	): Promise<BatchCorrectionResult> {
		console.log(
			`[CorrectionAgent] Correcting block ${blockIndex} with ${segments.length} segments for file ${fileId}`
		);

		try {
			// Combine segment texts with spacing
			const batchText = segments.map(s => s.text).join(' ');
			const segmentIndices = segments.map(s => s.index);

			// Process batch with LLM
			const { correctedText, validationIssues, retryCount } = await this.processBatch(batchText);

			// Align corrected text back to segments
			const alignments = alignSegments(segments, correctedText);

			const result: BatchCorrectionResult = {
				blockIndex,
				segmentIndices,
				originalText: batchText,
				correctedText,
				alignments,
				status: 'completed',
				validationIssues,
				retryCount,
				inputLength: batchText.length,
				outputLength: correctedText.length,
				lengthRatio: batchText.length > 0 ? correctedText.length / batchText.length : 0
			};

			// Store result in database
			await this.saveBlockResult(fileId, result);

			console.log(
				`[CorrectionAgent] Block ${blockIndex} completed: ${result.inputLength} -> ${result.outputLength} chars (${(result.lengthRatio * 100).toFixed(1)}%)`
			);

			return result;
		} catch (error: any) {
			console.error(`[CorrectionAgent] Error correcting block ${blockIndex}:`, error);

			const errorResult: BatchCorrectionResult = {
				blockIndex,
				segmentIndices: segments.map(s => s.index),
				originalText: segments.map(s => s.text).join(' '),
				correctedText: '',
				alignments: [],
				status: 'error',
				error: error.message || 'Unknown error',
				inputLength: 0,
				outputLength: 0,
				lengthRatio: 0
			};

			// Still save the error result
			await this.saveBlockResult(fileId, errorResult);

			return errorResult;
		}
	}

	/**
	 * Save block correction result to database
	 */
	private async saveBlockResult(fileId: string, result: BatchCorrectionResult): Promise<void> {
		try {
			await prisma.transcriptCorrection.upsert({
				where: {
					fileId_blockIndex: {
						fileId,
						blockIndex: result.blockIndex
					}
				},
				create: {
					fileId,
					blockIndex: result.blockIndex,
					segmentIndices: result.segmentIndices,
					originalText: result.originalText,
					correctedText: result.correctedText,
					suggestions: result.alignments as any, // Store alignments as JSON
					status: result.status,
					error: result.error
				},
				update: {
					segmentIndices: result.segmentIndices,
					originalText: result.originalText,
					correctedText: result.correctedText,
					suggestions: result.alignments as any,
					status: result.status,
					error: result.error
				}
			});
		} catch (error) {
			console.error(`[CorrectionAgent] Error saving block result:`, error);
		}
	}

	/**
	 * Correct an entire file by processing segments in batches
	 */
	async correctFile(fileId: string, segments: TimedSegment[]): Promise<FileCorrectionResult> {
		console.log(
			`[CorrectionAgent] Starting file correction for ${fileId} with ${segments.length} segments`
		);

		const totalBlocks = Math.ceil(segments.length / this.batchSize);
		const blocks: BatchCorrectionResult[] = [];

		// Check for existing corrections and resume if needed
		const existingCorrections = await prisma.transcriptCorrection.findMany({
			where: { fileId },
			orderBy: { blockIndex: 'asc' }
		});

		const completedBlockIndices = new Set(
			existingCorrections.filter(c => c.status === 'completed').map(c => c.blockIndex)
		);

		console.log(
			`[CorrectionAgent] Found ${existingCorrections.length} existing corrections, ${completedBlockIndices.size} completed`
		);

		// Process blocks
		for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
			// Skip already completed blocks
			if (completedBlockIndices.has(blockIndex)) {
				console.log(`[CorrectionAgent] Skipping already completed block ${blockIndex}`);
				const existingBlock = existingCorrections.find(c => c.blockIndex === blockIndex)!;

				blocks.push({
					blockIndex: existingBlock.blockIndex,
					segmentIndices: existingBlock.segmentIndices,
					originalText: existingBlock.originalText,
					correctedText: existingBlock.correctedText,
					alignments: (existingBlock.suggestions as any) || [],
					status: existingBlock.status as 'completed' | 'error',
					error: existingBlock.error || undefined,
					inputLength: existingBlock.originalText.length,
					outputLength: existingBlock.correctedText.length,
					lengthRatio:
						existingBlock.originalText.length > 0
							? existingBlock.correctedText.length / existingBlock.originalText.length
							: 0
				});
				continue;
			}

			const startIdx = blockIndex * this.batchSize;
			const endIdx = Math.min(startIdx + this.batchSize, segments.length);
			const batchSegments = segments.slice(startIdx, endIdx);

			console.log(
				`[CorrectionAgent] Processing block ${blockIndex + 1}/${totalBlocks} (segments ${startIdx}-${endIdx})`
			);

			const blockResult = await this.correctBatch(fileId, blockIndex, batchSegments);
			blocks.push(blockResult);
		}

		// Calculate success rate
		const completedBlocks = blocks.filter(b => b.status === 'completed').length;
		const successRate = totalBlocks > 0 ? (completedBlocks / totalBlocks * 100).toFixed(1) : '0';

		const result: FileCorrectionResult = {
			fileId,
			totalBlocks,
			completedBlocks,
			successRate: `${successRate}%`,
			blocks,
			status: completedBlocks === totalBlocks ? 'completed' : completedBlocks > 0 ? 'partial' : 'error'
		};

		console.log(
			`[CorrectionAgent] File correction completed: ${completedBlocks}/${totalBlocks} blocks (${successRate}%)`
		);

		return result;
	}

	/**
	 * Get existing corrections for a file
	 */
	async getFileCorrections(fileId: string): Promise<FileCorrectionResult | null> {
		const corrections = await prisma.transcriptCorrection.findMany({
			where: { fileId },
			orderBy: { blockIndex: 'asc' }
		});

		if (corrections.length === 0) {
			return null;
		}

		const blocks: BatchCorrectionResult[] = corrections.map(c => ({
			blockIndex: c.blockIndex,
			segmentIndices: c.segmentIndices,
			originalText: c.originalText,
			correctedText: c.correctedText,
			alignments: (c.suggestions as any) || [],
			status: c.status as 'completed' | 'error',
			error: c.error || undefined,
			inputLength: c.originalText.length,
			outputLength: c.correctedText.length,
			lengthRatio: c.originalText.length > 0 ? c.correctedText.length / c.originalText.length : 0
		}));

		const completedBlocks = blocks.filter(b => b.status === 'completed').length;
		const totalBlocks = blocks.length;
		const successRate = totalBlocks > 0 ? (completedBlocks / totalBlocks * 100).toFixed(1) : '0';

		return {
			fileId,
			totalBlocks,
			completedBlocks,
			successRate: `${successRate}%`,
			blocks,
			status: completedBlocks === totalBlocks ? 'completed' : completedBlocks > 0 ? 'partial' : 'error'
		};
	}
}

/**
 * Create a default correction agent instance
 */
export function createCorrectionAgent(config?: CorrectionAgentConfig): CorrectionAgent {
	return new CorrectionAgent(config);
}
