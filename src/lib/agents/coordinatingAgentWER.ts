import {
	createOpenRouterChat,
	DEFAULT_MODEL,
	DEFAULT_MODEL_NAME,
	OPENROUTER_MODELS
} from '$lib/llm/openrouter-direct';
import { HumanMessage } from '@langchain/core/messages';
import type { TranscriptSummary, TranscriptCorrection } from '@prisma/client';
import { prisma } from '$lib/db/client';
import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
import { getLanguageName, normalizeLanguageCode } from '$lib/utils/language';
import { getAgentFileLogger, type AgentFileLogger } from '$lib/utils/agentFileLogger';
import { extractSpeakerSegments } from '$lib/utils/extractWordsFromEditor';
import type { TipTapEditorContent } from '../../types';
import { WER_PROMPTS } from './prompts/wer_analysis';

export interface WERBlockAnalysisRequest {
	fileId: string;
	segments: SegmentWithTiming[]; // Up to 20 segments
	summary: TranscriptSummary;
	blockIndex: number;
	uiLanguage?: string;
	transcriptFilePath?: string;
}

export interface WERCorrection {
	id: string;
	original: string;
	replacement: string;
	confidence: number;
}

export interface WERBlockAnalysisResult {
	blockIndex: number;
	corrections: WERCorrection[];
	correctedText: string;
	llmInteractions: Array<{
		prompt: string;
		response: string;
		timestamp: number;
		type: 'initial' | 'clarification';
	}>;
	processingTimeMs: number;
}

export interface WERFileAnalysisRequest {
	fileId: string;
	editorContent: TipTapEditorContent;
	summary: TranscriptSummary;
	uiLanguage?: string;
	transcriptFilePath?: string;
}

const BLOCK_SIZE = 20; // Process 20 segments at a time

/**
 * Simplified coordination agent focused on WER improvement
 * Processes transcript in blocks of 20 segments with simpler prompts and structure
 */
export class CoordinatingAgentWER {
	private model;
	private fallbackModel;
	private primaryModelName: string;
	private logger: AgentFileLogger | null = null;
	private phoneticTool: any = null;

	constructor(modelName: string = DEFAULT_MODEL) {
		this.primaryModelName = modelName;
		this.model = createOpenRouterChat({
			modelName,
			temperature: 0.1, // Lower temperature for more consistent corrections
			maxTokens: 4000
		});

		// Create fallback model (GPT-4o) if primary model is different
		const fallbackModelName = OPENROUTER_MODELS.GPT_4O;
		if (modelName !== fallbackModelName) {
			this.fallbackModel = createOpenRouterChat({
				modelName: fallbackModelName,
				temperature: 0.1,
				maxTokens: 4000
			});
		}
	}

	private initializeLogger(transcriptFilePath: string, fileId: string): void {
		if (!this.logger && transcriptFilePath) {
			this.logger = getAgentFileLogger(transcriptFilePath, fileId);
		}
	}

	private async initializePhoneticTool() {
		if (this.phoneticTool) return;

		// Only load on server side
		if (typeof window === 'undefined') {
			try {
				const { createPhoneticAnalyzerTool } = await import('./tools/phoneticAnalyzer');
				this.phoneticTool = createPhoneticAnalyzerTool();
				await this.logger?.logGeneral('info', 'PhoneticAnalyzerTool initialized for WER analysis');
			} catch (e) {
				await this.logger?.logGeneral(
					'warn',
					'Failed to load PhoneticAnalyzer tool for WER analysis',
					{ error: e }
				);
			}
		}
	}

	/**
	 * Invoke model with automatic fallback
	 */
	private async invokeWithFallback(messages: any[]): Promise<any> {
		try {
			const response = await this.model.invoke(messages);

			// Check for empty or whitespace-only responses
			const content = response.content as string;
			if (!content || content.trim().length === 0) {
				throw new Error(`Empty response from ${this.primaryModelName}`);
			}

			return response;
		} catch (error: any) {
			const isEmptyResponse =
				error?.message?.includes('Empty response') ||
				error?.message?.includes('model configuration issue');

			if (isEmptyResponse && this.fallbackModel) {
				await this.logger?.logGeneral(
					'warn',
					`Primary model ${this.primaryModelName} failed, falling back to GPT-4o`,
					{ error: error.message }
				);

				try {
					const fallbackResponse = await this.fallbackModel.invoke(messages);
					await this.logger?.logGeneral('info', 'Successfully fell back to GPT-4o', {
						responseLength: (fallbackResponse.content as string).length
					});
					return fallbackResponse;
				} catch (fallbackError: any) {
					await this.logger?.logGeneral('error', 'Both primary and fallback models failed', {
						primaryError: error.message,
						fallbackError: fallbackError.message
					});
					throw new Error(
						`Both ${this.primaryModelName} and GPT-4o failed: ${fallbackError.message}`
					);
				}
			}

			throw error;
		}
	}

	/**
	 * Parse JSON response with simple error handling
	 */
	private parseResponse(response: string): { corrections: WERCorrection[] } {
		try {
			// Clean the response
			let cleanResponse = response.trim();

			// Remove markdown code blocks if present
			if (cleanResponse.startsWith('```json')) {
				cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
			} else if (cleanResponse.startsWith('```')) {
				cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
			}

			const parsed = JSON.parse(cleanResponse);

			// Validate structure
			if (!parsed.corrections || !Array.isArray(parsed.corrections)) {
				throw new Error('Invalid response structure: missing corrections array');
			}

			// Validate each correction
			for (const correction of parsed.corrections) {
				if (!correction.id || !correction.original || !correction.replacement) {
					throw new Error('Invalid correction structure: missing id, original, or replacement');
				}
				if (typeof correction.confidence !== 'number') {
					correction.confidence = 0.7; // Default confidence
				}
			}

			return parsed;
		} catch (error) {
			this.logger?.logGeneral('error', 'Failed to parse LLM response', {
				error: error.message,
				response: response.substring(0, 500)
			});

			// Return empty corrections on parse error
			return { corrections: [] };
		}
	}

	/**
	 * Perform strategic phonetic analysis on top corrections only
	 */
	private async performStrategicPhoneticAnalysis(
		corrections: WERCorrection[],
		blockIndex: number
	): Promise<WERCorrection[]> {
		// Initialize phonetic tool if needed
		await this.initializePhoneticTool();

		if (!this.phoneticTool || corrections.length === 0) {
			return corrections;
		}

		// Sort by confidence and analyze only top 3 corrections
		const topCorrections = corrections
			.filter((c) => c.confidence >= 0.6) // Only analyze medium+ confidence corrections
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, 3); // Limit to top 3 to avoid overwhelming the phonetic tool

		await this.logger?.logGeneral('info', 'Performing strategic phonetic analysis', {
			blockIndex,
			totalCorrections: corrections.length,
			analyzingTop: topCorrections.length
		});

		// Analyze each top correction
		for (const correction of topCorrections) {
			if (!correction.original || !correction.replacement) continue;

			try {
				const phoneticStart = Date.now();
				const phoneticInput = {
					text: correction.original,
					candidate: correction.replacement
				};

				await this.logger?.logToolCall('PhoneticAnalyzer-WER', phoneticInput, blockIndex);

				const phoneticData = await this.phoneticTool.analyzePhoneticSimilarity(phoneticInput);

				const phoneticDuration = Date.now() - phoneticStart;
				await this.logger?.logToolResponse(
					'PhoneticAnalyzer-WER',
					phoneticData,
					phoneticDuration,
					blockIndex
				);

				// Boost confidence for high phonetic similarity (potential homophones)
				if (phoneticData.similarity_score >= 0.7) {
					const originalConfidence = correction.confidence;
					const phoneticBoost = (phoneticData.similarity_score - 0.7) * 0.3; // 0.0 to 0.09 boost
					correction.confidence = Math.min(1.0, originalConfidence + phoneticBoost);

					await this.logger?.logGeneral('info', 'Phonetic similarity boost applied', {
						blockIndex,
						correctionId: correction.id,
						originalConfidence,
						newConfidence: correction.confidence,
						similarityScore: phoneticData.similarity_score
					});
				} else {
					await this.logger?.logGeneral('debug', 'Low phonetic similarity, no boost', {
						blockIndex,
						correctionId: correction.id,
						similarityScore: phoneticData.similarity_score
					});
				}

				// Add phonetic metadata for debugging
				(correction as any).phoneticAnalysis = {
					similarity_score: phoneticData.similarity_score,
					is_likely_homophone: phoneticData.similarity_score >= 0.7
				};
			} catch (error) {
				await this.logger?.logGeneral('warn', 'Phonetic analysis failed for correction', {
					blockIndex,
					correctionId: correction.id,
					error: error.message
				});
				// Continue with other corrections
			}
		}

		return corrections;
	}

	/**
	 * Apply corrections to text with conflict handling
	 */
	private async applyCorrections(
		originalText: string,
		corrections: WERCorrection[],
		blockIndex: number
	): Promise<{
		correctedText: string;
		appliedCorrections: WERCorrection[];
		conflictedCorrections: WERCorrection[];
		clarificationInteractions: Array<{
			prompt: string;
			response: string;
			timestamp: number;
			type: 'clarification';
		}>;
	}> {
		let correctedText = originalText;
		const appliedCorrections: WERCorrection[] = [];
		const conflictedCorrections: WERCorrection[] = [];
		const clarificationInteractions: Array<{
			prompt: string;
			response: string;
			timestamp: number;
			type: 'clarification';
		}> = [];

		for (const correction of corrections) {
			const occurrences = (
				correctedText.match(new RegExp(escapeRegExp(correction.original), 'g')) || []
			).length;

			if (occurrences === 0) {
				await this.logger?.logGeneral('warn', 'Text not found for correction', {
					blockIndex,
					correctionId: correction.id,
					original: correction.original
				});
				conflictedCorrections.push(correction);
			} else if (occurrences === 1) {
				// Simple replacement
				correctedText = correctedText.replace(correction.original, correction.replacement);
				appliedCorrections.push(correction);
				await this.logger?.logGeneral('info', 'Applied correction', {
					blockIndex,
					correctionId: correction.id,
					original: correction.original,
					replacement: correction.replacement
				});
			} else {
				// Multiple matches - ask LLM for clarification
				await this.logger?.logGeneral('warn', 'Multiple matches found, requesting clarification', {
					blockIndex,
					correctionId: correction.id,
					occurrences
				});

				const clarificationPrompt = WER_PROMPTS.CLARIFICATION_PROMPT.replace(
					'{originalText}',
					correction.original
				)
					.replace('{replacementText}', correction.replacement)
					.replace('{textSnippet}', correctedText)
					.replace('{correctionId}', correction.id);

				try {
					const clarificationStart = Date.now();
					const clarificationResponse = await this.invokeWithFallback([
						new HumanMessage({ content: clarificationPrompt })
					]);

					const clarificationContent = clarificationResponse.content as string;
					clarificationInteractions.push({
						prompt: clarificationPrompt,
						response: clarificationContent,
						timestamp: clarificationStart,
						type: 'clarification'
					});

					const clarification = JSON.parse(clarificationContent.trim());

					if (clarification.specificText) {
						// Try to apply the more specific correction
						if (correctedText.includes(clarification.specificText)) {
							correctedText = correctedText.replace(
								clarification.specificText,
								clarification.specificText.replace(correction.original, correction.replacement)
							);
							appliedCorrections.push(correction);
						} else {
							conflictedCorrections.push(correction);
						}
					} else {
						conflictedCorrections.push(correction);
					}
				} catch (error) {
					await this.logger?.logGeneral('error', 'Clarification request failed', {
						blockIndex,
						correctionId: correction.id,
						error: error.message
					});
					conflictedCorrections.push(correction);
				}
			}
		}

		return {
			correctedText,
			appliedCorrections,
			conflictedCorrections,
			clarificationInteractions
		};
	}

	/**
	 * Format segments for LLM input
	 */
	private formatSegmentsForLLM(segments: SegmentWithTiming[]): string {
		return segments
			.map((segment) => {
				let segmentText = `${segment.speakerName || segment.speakerTag || 'Speaker'}: ${segment.text}`;

				// Add alternatives if available
				if (segment.alternatives && segment.alternatives.length > 0) {
					const alts = segment.alternatives
						.slice(0, 3) // Limit to top 3 alternatives
						.map((alt) => alt.text)
						.join(' | ');
					segmentText += `\nAlternatives: ${alts}`;
				}

				return segmentText;
			})
			.join('\n\n');
	}

	/**
	 * Analyze a single block of segments (up to 20)
	 */
	async analyzeBlock(request: WERBlockAnalysisRequest): Promise<WERBlockAnalysisResult> {
		const startTime = Date.now();
		const { segments, summary, blockIndex, fileId, uiLanguage, transcriptFilePath } = request;

		// Initialize logger
		if (transcriptFilePath) {
			this.initializeLogger(transcriptFilePath, fileId);
		}

		await this.logger?.logGeneral('info', `Starting WER block analysis`, {
			blockIndex,
			segmentCount: segments.length,
			segmentRange:
				segments.length > 0
					? `${segments[0]?.index || 0}-${segments[segments.length - 1]?.index || 0}`
					: '0-0'
		});

		// Normalize language
		const normalizedLanguage = normalizeLanguageCode(uiLanguage);
		const responseLanguage = getLanguageName(normalizedLanguage);

		// Format input for LLM
		const formattedSegments = this.formatSegmentsForLLM(segments);

		// Build prompt using template
		const prompt = WER_PROMPTS.BLOCK_ANALYSIS_PROMPT.replace('{summary}', summary.summary)
			.replace('{segmentsText}', formattedSegments)
			.replace('{responseLanguage}', responseLanguage);

		// Get initial analysis
		const llmStart = Date.now();
		await this.logger?.logLLMRequest(prompt, `${DEFAULT_MODEL_NAME} (WER Block ${blockIndex})`);

		const response = await this.invokeWithFallback([new HumanMessage({ content: prompt })]);
		const responseContent = response.content as string;

		const llmDuration = Date.now() - llmStart;
		await this.logger?.logLLMResponse(responseContent, llmDuration);

		// Parse response
		const parsed = this.parseResponse(responseContent);

		// Perform strategic phonetic analysis on top corrections
		const enhancedCorrections = await this.performStrategicPhoneticAnalysis(
			parsed.corrections,
			blockIndex
		);

		// Apply corrections to get corrected text
		const originalText = formattedSegments;
		const applyResult = await this.applyCorrections(originalText, enhancedCorrections, blockIndex);

		const processingTimeMs = Date.now() - startTime;

		await this.logger?.logGeneral('info', `WER block analysis completed`, {
			blockIndex,
			correctionsFound: parsed.corrections.length,
			correctionsApplied: applyResult.appliedCorrections.length,
			conflictedCorrections: applyResult.conflictedCorrections.length,
			processingTimeMs
		});

		// Build interaction history
		const llmInteractions = [
			{
				prompt,
				response: responseContent,
				timestamp: llmStart,
				type: 'initial' as const
			},
			...applyResult.clarificationInteractions
		];

		return {
			blockIndex,
			corrections: applyResult.appliedCorrections,
			correctedText: applyResult.correctedText,
			llmInteractions,
			processingTimeMs
		};
	}

	/**
	 * Analyze entire file in blocks of 20 segments
	 */
	async analyzeFile(request: WERFileAnalysisRequest): Promise<{
		fileId: string;
		totalBlocks: number;
		completedBlocks: number;
		results: WERBlockAnalysisResult[];
	}> {
		const { fileId, editorContent, summary, uiLanguage, transcriptFilePath } = request;

		// Initialize logger
		if (transcriptFilePath) {
			this.initializeLogger(transcriptFilePath, fileId);
		}

		await this.logger?.logGeneral('info', 'Starting WER file analysis', { fileId });

		// Extract segments from editor content
		const segments = extractSpeakerSegments(editorContent) || [];
		const totalBlocks = Math.ceil(Math.max(1, segments.length) / BLOCK_SIZE);

		await this.logger?.logGeneral('info', `File analysis plan`, {
			totalSegments: segments.length,
			totalBlocks,
			blockSize: BLOCK_SIZE
		});

		// If no segments were extracted, log the issue and return early
		if (segments.length === 0) {
			await this.logger?.logGeneral('warn', 'No segments extracted from editor content', {
				editorContentType: typeof editorContent,
				editorContentKeys: editorContent ? Object.keys(editorContent) : 'null'
			});

			return {
				fileId,
				totalBlocks: 1,
				completedBlocks: 0,
				results: []
			};
		}

		const results: WERBlockAnalysisResult[] = [];

		// Process each block sequentially (no concurrency)
		for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
			const startIdx = blockIndex * BLOCK_SIZE;
			const endIdx = Math.min(startIdx + BLOCK_SIZE, segments.length);
			const blockSegments = segments.slice(startIdx, endIdx);

			try {
				await this.logger?.logGeneral('info', `Processing block ${blockIndex + 1}/${totalBlocks}`, {
					blockIndex,
					segmentRange: `${startIdx}-${endIdx - 1}`,
					segmentCount: blockSegments.length
				});

				// Analyze this block
				const blockResult = await this.analyzeBlock({
					fileId,
					segments: blockSegments,
					summary,
					blockIndex,
					uiLanguage,
					transcriptFilePath
				});

				// Save block result to database
				await prisma.transcriptCorrection.upsert({
					where: {
						fileId_blockIndex: {
							fileId,
							blockIndex
						}
					},
					create: {
						fileId,
						blockIndex,
						segmentIndices: blockSegments.map((s) => s.index),
						originalText: this.formatSegmentsForLLM(blockSegments),
						correctedText: blockResult.correctedText,
						suggestions: JSON.stringify(blockResult.corrections),
						llmInteractions: JSON.stringify(blockResult.llmInteractions),
						processingTimeMs: blockResult.processingTimeMs,
						status: 'completed'
					},
					update: {
						segmentIndices: blockSegments.map((s) => s.index),
						originalText: this.formatSegmentsForLLM(blockSegments),
						correctedText: blockResult.correctedText,
						suggestions: JSON.stringify(blockResult.corrections),
						llmInteractions: JSON.stringify(blockResult.llmInteractions),
						processingTimeMs: blockResult.processingTimeMs,
						status: 'completed',
						error: null
					}
				});

				results.push(blockResult);

				await this.logger?.logGeneral('info', `Block ${blockIndex + 1} completed and saved`, {
					blockIndex,
					correctionsApplied: blockResult.corrections.length
				});
			} catch (error) {
				await this.logger?.logGeneral('error', `Block ${blockIndex + 1} failed`, {
					blockIndex,
					error: error.message
				});

				// Save error to database
				await prisma.transcriptCorrection.upsert({
					where: {
						fileId_blockIndex: {
							fileId,
							blockIndex
						}
					},
					create: {
						fileId,
						blockIndex,
						segmentIndices: blockSegments.map((s) => s.index),
						originalText: this.formatSegmentsForLLM(blockSegments),
						status: 'error',
						error: error.message
					},
					update: {
						status: 'error',
						error: error.message
					}
				});

				// Continue with next block instead of failing entire analysis
				continue;
			}
		}

		await this.logger?.logGeneral('info', 'WER file analysis completed', {
			fileId,
			totalBlocks,
			completedBlocks: results.length,
			successRate: `${((results.length / totalBlocks) * 100).toFixed(1)}%`
		});

		return {
			fileId,
			totalBlocks,
			completedBlocks: results.length,
			results
		};
	}

	/**
	 * Get analysis results for a file
	 */
	async getAnalysisResults(fileId: string): Promise<TranscriptCorrection[]> {
		return prisma.transcriptCorrection.findMany({
			where: { fileId },
			orderBy: { blockIndex: 'asc' }
		});
	}
}

// Helper function to escape regex special characters
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Singleton instance
let coordinatingAgentWERInstance: CoordinatingAgentWER | null = null;

export function getCoordinatingAgentWER(modelName?: string): CoordinatingAgentWER {
	if (!coordinatingAgentWERInstance || modelName) {
		coordinatingAgentWERInstance = new CoordinatingAgentWER(modelName);
	}
	return coordinatingAgentWERInstance;
}
