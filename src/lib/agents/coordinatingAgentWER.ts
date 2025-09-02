import { createOpenRouterChat, DEFAULT_MODEL, OPENROUTER_MODELS } from '$lib/llm/openrouter-direct';
import { HumanMessage } from '@langchain/core/messages';
import { createWebSearchTool } from './tools';
import type { TranscriptSummary, TranscriptCorrection } from '@prisma/client';
import { prisma } from '$lib/db/client';
import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
import { getLanguageName, normalizeLanguageCode } from '$lib/utils/language';
import { getAgentFileLogger, type AgentFileLogger } from '$lib/utils/agentFileLogger';
import { extractSpeakerSegments } from '$lib/utils/extractWordsFromEditor';
import type { TipTapEditorContent } from '../../types';
import { WER_PROMPTS } from './prompts/wer_analysis';
import {
	robustJsonParse,
	validateJsonStructure,
	formatParsingErrorForLLM
} from './utils/jsonParser';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface WERBlockAnalysisRequest {
	fileId: string;
	segments: SegmentWithTiming[]; // Up to 20 segments
	summary: TranscriptSummary;
	blockIndex: number;
	uiLanguage?: string;
	transcriptFilePath?: string;
	audioFilePath?: string; // For ASR alternatives
	alternativeSegments?: SegmentWithTiming[]; // Alternative Estonian-only ASR segments
}

export interface WERCorrection {
	id: string;
	original: string;
	replacement: string;
	confidence: number;
	evidenceType?: string;
	nBestSupport?: string[];
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
	audioFilePath?: string; // For ASR alternatives
	originalFilename?: string; // For loading alternative ASR JSON
}

const BLOCK_SIZE = 20; // Process 20 segments at a time

// Alternative ASR data structures (same as main ASR)
interface AlternativeASRWord {
	word: string;
	word_with_punctuation: string;
	start: number;
	end: number;
	confidence: number;
	punctuation?: string;
}

interface AlternativeASRTurn {
	start: number;
	end: number;
	speaker: string;
	transcript: string;
	words: AlternativeASRWord[];
}

interface AlternativeASRSection {
	start: number;
	end: number;
	type: string;
	turns: AlternativeASRTurn[];
}

interface AlternativeASRResult {
	speakers: Record<string, any>;
	sections: AlternativeASRSection[];
}

/**
 * Parse alternative Estonian-only ASR JSON file
 */
function parseAlternativeASRJson(jsonFilePath: string): AlternativeASRResult | null {
	try {
		if (!existsSync(jsonFilePath)) {
			console.log(`[ALT-ASR] Alternative ASR file not found: ${jsonFilePath}`);
			return null;
		}

		const jsonContent = readFileSync(jsonFilePath, 'utf-8');
		const data = JSON.parse(jsonContent);

		if (!data.sections || !Array.isArray(data.sections)) {
			console.warn(`[ALT-ASR] Invalid ASR structure in ${jsonFilePath}`);
			return null;
		}

		console.log(`[ALT-ASR] Successfully loaded alternative ASR from ${jsonFilePath}`);
		return data as AlternativeASRResult;
	} catch (error) {
		console.error(`[ALT-ASR] Error parsing alternative ASR JSON: ${error.message}`);
		return null;
	}
}

/**
 * Extract alternative segments within specified timeframe to match main ASR segments
 */
function extractAlternativeSegments(
	alternativeASR: AlternativeASRResult,
	startTime: number,
	endTime: number
): SegmentWithTiming[] {
	const extractedSegments: SegmentWithTiming[] = [];

	// Get all turns from all speech sections
	const allTurns: AlternativeASRTurn[] = [];
	alternativeASR.sections.forEach((section) => {
		if (section.type === 'speech' && section.turns) {
			allTurns.push(...section.turns);
		}
	});

	// Extract words within the timeframe
	const wordsInTimeframe: Array<
		AlternativeASRWord & { turnStart: number; turnEnd: number; speaker: string }
	> = [];

	allTurns.forEach((turn) => {
		// Check if turn overlaps with our timeframe
		if (turn.start < endTime && turn.end > startTime) {
			turn.words.forEach((word) => {
				if (word.start >= startTime && word.end <= endTime) {
					wordsInTimeframe.push({
						...word,
						turnStart: turn.start,
						turnEnd: turn.end,
						speaker: turn.speaker
					});
				}
			});
		}
	});

	if (wordsInTimeframe.length === 0) {
		return extractedSegments;
	}

	// Sort words by start time
	wordsInTimeframe.sort((a, b) => a.start - b.start);

	// Group words into segments (preserve alternative segmentation)
	let currentSegment: any = null;
	let segmentIndex = 0;

	wordsInTimeframe.forEach((word) => {
		// Start new segment if:
		// 1. First word
		// 2. Different speaker
		// 3. Gap > 2 seconds
		// 4. Different turn
		const shouldStartNewSegment =
			!currentSegment ||
			currentSegment.speaker !== word.speaker ||
			word.start - currentSegment.endTime > 2.0 ||
			currentSegment.turnStart !== word.turnStart;

		if (shouldStartNewSegment) {
			// Save previous segment if exists
			if (currentSegment && currentSegment.words.length > 0) {
				const segmentText = currentSegment.words
					.map((w: AlternativeASRWord) => w.word_with_punctuation)
					.join(' ')
					.trim();

				extractedSegments.push({
					index: segmentIndex++,
					text: segmentText,
					startTime: currentSegment.startTime,
					endTime: currentSegment.endTime,
					startWord: 0, // Alternative ASR segments don't track word positions
					endWord: 0,
					speakerName: currentSegment.speakerName,
					speakerTag: currentSegment.speaker,
					words: [], // Would need to convert if needed
					alternatives: [] // Alternative ASR doesn't have n-best
				});
			}

			// Start new segment
			currentSegment = {
				startTime: word.start,
				endTime: word.end,
				speaker: word.speaker,
				speakerName: `Alt-Speaker-${word.speaker}`,
				turnStart: word.turnStart,
				words: [word]
			};
		} else {
			// Add to current segment
			currentSegment.words.push(word);
			currentSegment.endTime = word.end;
		}
	});

	// Add final segment
	if (currentSegment && currentSegment.words.length > 0) {
		const segmentText = currentSegment.words
			.map((w: AlternativeASRWord) => w.word_with_punctuation)
			.join(' ')
			.trim();

		extractedSegments.push({
			index: segmentIndex,
			text: segmentText,
			startTime: currentSegment.startTime,
			endTime: currentSegment.endTime,
			startWord: 0, // Alternative ASR segments don't track word positions
			endWord: 0,
			speakerName: currentSegment.speakerName,
			speakerTag: currentSegment.speaker,
			words: [], // Would need to convert if needed
			alternatives: [] // Alternative ASR doesn't have n-best
		});
	}

	console.log(
		`[ALT-ASR] Extracted ${extractedSegments.length} alternative segments from timeframe ${startTime}-${endTime}s`
	);
	return extractedSegments;
}

/**
 * Get alternative ASR file path based on original filename
 */
function getAlternativeASRPath(originalFilename: string): string | null {
	if (!originalFilename) return null;

	// Clean filename: remove extension but keep other characters for exact folder matching
	const cleanName = originalFilename
		.replace(/\.[^/.]+$/, '') // Remove extension only
		.trim();

	const alternativeJsonPath = join(
		'/home/aivo/dev/est-asr-pipeline/results/podcast',
		cleanName,
		'result.json'
	);

	console.log(`[ALT-ASR] Looking for alternative ASR at: ${alternativeJsonPath}`);
	return alternativeJsonPath;
}

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
	private signalQualityTool: any = null;
	private webSearchTool;

	constructor(modelName: string = DEFAULT_MODEL) {
		this.primaryModelName = modelName;
		this.model = createOpenRouterChat({
			modelName,
			temperature: 0.1, // Lower temperature for more consistent corrections
			maxTokens: 12000, // Increased for detailed N-best variance analysis prompts
			enableCaching: true, // Enable prompt caching
			cacheBreakpoints: modelName.includes('anthropic') || modelName.includes('claude') || modelName.includes('gemini') ? [0] : [] // Cache static instructions for Anthropic and Gemini models
		});

		// Create fallback model (GPT-4o) if primary model is different
		const fallbackModelName = OPENROUTER_MODELS.GPT_4O;
		if (modelName !== fallbackModelName) {
			this.fallbackModel = createOpenRouterChat({
				modelName: fallbackModelName,
				temperature: 0.1,
				maxTokens: 12000, // Increased for detailed N-best variance analysis prompts
				enableCaching: true, // Enable prompt caching for fallback too
				cacheBreakpoints:
					fallbackModelName.includes('anthropic') || fallbackModelName.includes('claude') ? [0] : []
			});
		}

		// Initialize web search tool
		this.webSearchTool = createWebSearchTool();
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

	private async initializeSignalQualityTool() {
		if (this.signalQualityTool) return;

		// Only load on server side
		if (typeof window === 'undefined') {
			try {
				const { createSignalQualityAssessorTool } = await import('./tools/signalQualityAssessor');
				this.signalQualityTool = createSignalQualityAssessorTool();
				await this.logger?.logGeneral(
					'info',
					'SignalQualityAssessorTool initialized for WER analysis'
				);
			} catch (e) {
				await this.logger?.logGeneral(
					'warn',
					'Failed to load SignalQualityAssessor tool for WER analysis',
					{ error: e }
				);
			}
		}
	}

	/**
	 * Invoke model with automatic fallback
	 */
	private async invokeWithFallback(messages: any[]): Promise<any> {
		const invokeStart = Date.now();
		try {
			// Log the outgoing prompt
			const promptContent = messages.map((m) => m.content).join('\n');
			await this.logger?.logLLMRequest(promptContent, `${this.primaryModelName} (Primary Model)`);

			const response = await this.model.invoke(messages);

			// Check for empty or whitespace-only responses
			const content = response.content as string;
			if (!content || content.trim().length === 0) {
				throw new Error(`Empty response from ${this.primaryModelName}`);
			}

			// Log the response with timing and cache metrics
			const invokeDuration = Date.now() - invokeStart;
			await this.logger?.logLLMResponse(content, invokeDuration);

			// Log cache metrics if available
			if (response.cacheMetrics) {
				await this.logger?.logGeneral('info', 'Cache metrics', {
					model: this.primaryModelName,
					...response.cacheMetrics
				});
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
					// Log fallback prompt
					const fallbackPromptContent = messages.map((m) => m.content).join('\n');
					await this.logger?.logLLMRequest(fallbackPromptContent, 'GPT-4o (Fallback Model)');

					const fallbackResponse = await this.fallbackModel.invoke(messages);

					// Log fallback response with timing and cache metrics
					const fallbackContent = fallbackResponse.content as string;
					const fallbackDuration = Date.now() - invokeStart;
					await this.logger?.logLLMResponse(fallbackContent, fallbackDuration);

					// Log fallback cache metrics if available
					if (fallbackResponse.cacheMetrics) {
						await this.logger?.logGeneral('info', 'Fallback cache metrics', {
							model: 'GPT-4o (Fallback)',
							...fallbackResponse.cacheMetrics
						});
					}

					await this.logger?.logGeneral('info', 'Successfully fell back to GPT-4o', {
						responseLength: fallbackContent.length
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
	 * Parse JSON response with robust error handling and retry capability
	 */
	private async parseResponseWithRetry(
		response: string,
		expectedStructure: string[],
		maxRetries: number = 2
	): Promise<any> {
		await this.logger?.logGeneral('debug', 'JSON parsing attempt', {
			responseLength: response.length,
			responsePreview: response.substring(0, 200)
		});

		// First attempt: Use robust parsing utility
		const parseResult = robustJsonParse(response);

		if (parseResult.success) {
			await this.logger?.logGeneral('debug', 'JSON parsed successfully on first attempt', {
				fixesApplied: parseResult.fixesApplied
			});

			// Validate structure
			if (validateJsonStructure(parseResult.data, expectedStructure)) {
				return parseResult.data;
			} else {
				const missingKeys = expectedStructure.filter((key) => !(key in parseResult.data));
				await this.logger?.logGeneral('warn', 'JSON structure validation failed', {
					missingKeys
				});
			}
		} else {
			await this.logger?.logGeneral('warn', 'Initial JSON parsing failed', {
				error: parseResult.error,
				extractedJsonPreview: parseResult.extractedJson?.substring(0, 200)
			});
		}

		// Retry with LLM self-correction
		for (let retry = 1; retry <= maxRetries; retry++) {
			await this.logger?.logGeneral(
				'debug',
				`Retry ${retry}/${maxRetries}: Requesting JSON correction from LLM`
			);

			const correctionPrompt = `${formatParsingErrorForLLM(
				parseResult.error || 'Invalid JSON structure',
				response
			)}

Please provide ONLY valid JSON that matches this exact structure:
{
  "reasoning": "Brief explanation of correction decisions",
  "uncertaintyAssessment": {
    "divergenceScore": "high|medium|low",
    "phoneticSimilarity": true,
    "semanticDivergence": true,
    "correctionRecommended": true
  },
  "toolRequests": [],
  "needsMoreAnalysis": false,
  "corrections": [
    {
      "id": "c1", 
      "original": "exact text to replace",
      "replacement": "corrected text",
      "confidence": 0.85,
      "evidenceType": "n-best_composite|phonetic_validation|contextual_verification",
      "nBestSupport": ["hypothesis 2: example alternative"]
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No explanations, no text before or after, no markdown code blocks.`;

			await this.logger?.logGeneral('debug', 'Sending correction prompt to LLM');

			try {
				const correctionResponse = await this.invokeWithFallback([
					new HumanMessage({ content: correctionPrompt })
				]);
				const correctedText = correctionResponse.content as string;

				await this.logger?.logGeneral('debug', 'Received correction response from LLM', {
					responseLength: correctedText.length
				});

				// Try parsing the corrected response
				const correctedParseResult = robustJsonParse(correctedText);
				if (
					correctedParseResult.success &&
					validateJsonStructure(correctedParseResult.data, expectedStructure)
				) {
					await this.logger?.logGeneral('info', 'JSON correction successful', {
						retry,
						fixesApplied: correctedParseResult.fixesApplied
					});
					return correctedParseResult.data;
				} else {
					await this.logger?.logGeneral('warn', `Retry ${retry} failed`, {
						error: correctedParseResult.error
					});
				}
			} catch (retryError) {
				await this.logger?.logGeneral('error', `Retry ${retry} LLM call failed`, {
					error: retryError.message
				});
			}
		}

		// All retries failed - return fallback structure
		await this.logger?.logGeneral(
			'error',
			'All JSON parsing attempts failed, returning empty result'
		);
		return { corrections: [] };
	}

	/**
	 * Execute a single tool request with proper parameter validation
	 */
	private async executeToolRequest(
		toolRequest: { tool: string; params: any; rationale?: string },
		segments: SegmentWithTiming[],
		blockIndex: number,
		audioFilePath?: string
	): Promise<any> {
		const { tool, params } = toolRequest;

		await this.logger?.logGeneral('info', 'Executing tool request', {
			blockIndex,
			tool,
			params,
			rationale: toolRequest.rationale || 'No rationale provided'
		});

		try {
			switch (tool) {
				case 'phoneticAnalyzer': {
					await this.initializePhoneticTool();
					if (!this.phoneticTool) {
						throw new Error('PhoneticAnalyzer tool not available');
					}

					if (!params.text || !params.candidate) {
						throw new Error('PhoneticAnalyzer requires "text" and "candidate" parameters');
					}

					const result = await this.phoneticTool.analyzePhoneticSimilarity(params);
					return {
						tool: 'phoneticAnalyzer',
						params,
						result: {
							similarityScore: result.similarity_score,
							isLikelyHomophone: result.similarity_score >= 0.7,
							phoneticDistance: result.phonetic_distance || 'unknown'
						}
					};
				}

				case 'signalQualityAssessor': {
					await this.initializeSignalQualityTool();
					if (!this.signalQualityTool) {
						throw new Error('SignalQualityAssessor tool not available');
					}

					if (typeof params.startTime !== 'number' || typeof params.endTime !== 'number') {
						throw new Error(
							'SignalQualityAssessor requires numeric "startTime" and "endTime" parameters'
						);
					}

					const qualityData = await this.signalQualityTool.assessSignalQuality({
						audioFilePath,
						startTime: params.startTime,
						endTime: params.endTime
					});

					return {
						tool: 'signalQualityAssessor',
						params,
						result: {
							snrDb: qualityData.snr_db,
							qualityCategory: qualityData.quality_category,
							recommendation:
								qualityData.quality_category === 'poor'
									? 'Be more conservative with corrections due to poor audio quality'
									: qualityData.quality_category === 'excellent'
										? 'Can be more confident with corrections due to excellent audio quality'
										: 'Use balanced confidence levels based on audio quality'
						}
					};
				}

				case 'webSearch': {
					if (!this.webSearchTool) {
						throw new Error('WebSearch tool not available');
					}

					if (!params.query) {
						throw new Error('WebSearch requires "query" parameter');
					}

					const language = params.language || 'et';
					const searchResult = await this.webSearchTool._call({
						query: params.query,
						language,
						maxResults: 3
					});

					const searchData = JSON.parse(searchResult);
					return {
						tool: 'webSearch',
						params,
						result: {
							query: params.query,
							resultsFound: searchData.results.length,
							topResults: searchData.results.slice(0, 2).map((r: any) => ({
								title: r.title,
								snippet: r.snippet.substring(0, 150) + (r.snippet.length > 150 ? '...' : '')
							})),
							summary:
								searchData.results.length > 0
									? `Found ${searchData.results.length} results for "${params.query}"`
									: `No results found for "${params.query}"`
						}
					};
				}

				default:
					throw new Error(`Unknown tool: ${tool}`);
			}
		} catch (error) {
			await this.logger?.logGeneral('error', 'Tool execution failed', {
				blockIndex,
				tool,
				error: error.message
			});

			return {
				tool,
				params,
				error: error.message,
				result: null
			};
		}
	}

	/**
	 * Execute multiple tool requests and format results for LLM feedback
	 */
	private async executeToolRequests(
		toolRequests: Array<{ tool: string; params: any; rationale?: string }>,
		segments: SegmentWithTiming[],
		blockIndex: number,
		audioFilePath?: string
	): Promise<string> {
		if (toolRequests.length === 0) {
			return '';
		}

		await this.logger?.logGeneral('info', 'Executing tool requests', {
			blockIndex,
			toolCount: toolRequests.length,
			tools: toolRequests.map((t) => t.tool)
		});

		const toolResults = [];

		for (const toolRequest of toolRequests) {
			const result = await this.executeToolRequest(
				toolRequest,
				segments,
				blockIndex,
				audioFilePath
			);
			toolResults.push(result);
		}

		// Format results for LLM consumption
		let formattedResults = '\n\nTOOL RESULTS:\n';

		for (const toolResult of toolResults) {
			if (toolResult.error) {
				formattedResults += `\n❌ ${toolResult.tool} FAILED: ${toolResult.error}\n`;
				continue;
			}

			formattedResults += `\n✅ ${toolResult.tool.toUpperCase()} RESULTS:\n`;

			switch (toolResult.tool) {
				case 'phoneticAnalyzer':
					formattedResults += `- Similarity Score: ${toolResult.result.similarityScore?.toFixed(2) || 'unknown'}\n`;
					formattedResults += `- Likely Homophone: ${toolResult.result.isLikelyHomophone ? 'YES' : 'NO'}\n`;
					formattedResults += `- Analysis: "${toolResult.params.text}" vs "${toolResult.params.candidate}"\n`;
					break;

				case 'signalQualityAssessor':
					formattedResults += `- Audio Quality: ${toolResult.result.qualityCategory || 'unknown'} (${toolResult.result.snrDb?.toFixed(1) || 'unknown'} dB)\n`;
					formattedResults += `- Recommendation: ${toolResult.result.recommendation}\n`;
					break;

				case 'webSearch':
					formattedResults += `- Query: "${toolResult.result.query}"\n`;
					formattedResults += `- Results Found: ${toolResult.result.resultsFound}\n`;
					if (toolResult.result.topResults.length > 0) {
						toolResult.result.topResults.forEach((r: any, i: number) => {
							formattedResults += `- Result ${i + 1}: ${r.title}\n  ${r.snippet}\n`;
						});
					}
					break;
			}
		}

		return formattedResults;
	}

	/**
	 * Run agentic analysis loop where LLM can request tools iteratively
	 */
	private async runAgenticAnalysis(
		segments: SegmentWithTiming[],
		summary: TranscriptSummary,
		signalQualityInfo: string,
		responseLanguage: string,
		blockIndex: number,
		audioFilePath?: string,
		alternativeSegments?: SegmentWithTiming[],
		maxIterations: number = 3
	): Promise<{ corrections: WERCorrection[]; interactions: any[] }> {
		const formattedSegments = this.formatSegmentsForLLM(segments);
		const interactions: any[] = [];

		// Format alternative segments if available
		let alternativeSegmentsText = '';
		if (alternativeSegments && alternativeSegments.length > 0) {
			alternativeSegmentsText =
				'\n\nALTERNATIVE ASR HYPOTHESIS (Estonian-only model):\n' +
				this.formatSegmentsForLLM(alternativeSegments, 'Alternative');

			await this.logger?.logGeneral('info', 'Including alternative ASR segments in analysis', {
				blockIndex,
				mainSegmentsCount: segments.length,
				alternativeSegmentsCount: alternativeSegments.length
			});
		}

		// Build cache-optimized prompt with static instructions first
		const dynamicContent = WER_PROMPTS.DYNAMIC_CONTENT_TEMPLATE.replace(
			'{responseLanguage}',
			responseLanguage
		)
			.replace('{summary}', summary.summary)
			.replace('{segmentsText}', formattedSegments + alternativeSegmentsText + signalQualityInfo);

		let currentPrompt = WER_PROMPTS.STATIC_INSTRUCTIONS + '\n\n' + dynamicContent;

		let iteration = 0;
		while (iteration < maxIterations) {
			iteration++;

			await this.logger?.logGeneral('info', 'Starting agentic analysis iteration', {
				blockIndex,
				iteration,
				maxIterations
			});

			// Send current prompt to LLM
			const llmStart = Date.now();

			const response = await this.invokeWithFallback([
				new HumanMessage({ content: currentPrompt })
			]);
			const responseContent = response.content as string;

			const llmDuration = Date.now() - llmStart;

			// Record interaction
			interactions.push({
				iteration,
				prompt: currentPrompt,
				response: responseContent,
				timestamp: llmStart,
				type: 'agentic_analysis'
			});

			// Parse response
			let parsedResponse;
			try {
				parsedResponse = await this.parseResponseWithRetry(responseContent, [
					'reasoning',
					'toolRequests',
					'needsMoreAnalysis',
					'corrections',
					'uncertaintyAssessment'
				]);
			} catch (error) {
				await this.logger?.logGeneral('error', 'Failed to parse agentic response', {
					blockIndex,
					iteration,
					error: error.message
				});
				// Return empty result on parse failure
				return { corrections: [], interactions };
			}

			const { reasoning, toolRequests = [], needsMoreAnalysis, corrections = [] } = parsedResponse;

			await this.logger?.logGeneral('info', 'Parsed agentic response', {
				blockIndex,
				iteration,
				reasoning: reasoning?.substring(0, 100),
				toolRequestsCount: toolRequests.length,
				needsMoreAnalysis,
				correctionsCount: corrections.length
			});

			// If no more analysis needed or we have final corrections, return result
			if (!needsMoreAnalysis || corrections.length > 0) {
				await this.logger?.logGeneral('info', 'Agentic analysis completed', {
					blockIndex,
					iterations: iteration,
					finalCorrections: corrections.length
				});

				return {
					corrections: corrections.map((c: any) => ({
						id: c.id,
						original: c.original,
						replacement: c.replacement,
						confidence: c.confidence,
						evidenceType: c.evidenceType,
						nBestSupport: c.nBestSupport
					})),
					interactions
				};
			}

			// Execute requested tools if any
			if (toolRequests.length > 0) {
				const toolResults = await this.executeToolRequests(
					toolRequests,
					segments,
					blockIndex,
					audioFilePath
				);

				// Build cache-optimized follow-up prompt with static instructions first
				const followUpDynamicContent = `Based on your previous analysis and the tool results below, provide your final corrections.

PREVIOUS ANALYSIS:
${reasoning}

${toolResults}

Now provide your final corrections in JSON format:
{
  "reasoning": "Brief explanation of your final decisions based on tool results and N-best analysis",
  "uncertaintyAssessment": {
    "divergenceScore": "high|medium|low",
    "phoneticSimilarity": true,
    "semanticDivergence": true,
    "correctionRecommended": true,
    "evidenceSources": ["primary N-best", "secondary ASR", "phonetic analysis"]
  },
  "toolRequests": [],
  "needsMoreAnalysis": false,
  "corrections": [
    {
      "id": "c1",
      "original": "exact text to replace",
      "replacement": "corrected text",
      "confidence": 0.85,
      "evidenceType": "n-best_composite|phonetic_validation|contextual_verification",
      "nBestSupport": ["hypothesis 2: example alternative", "hypothesis 3: another alternative"]
    }
  ]
}

IMPORTANT: Use the tool results above to make informed correction decisions. Only suggest corrections you are confident about (>0.7).`;

				currentPrompt = WER_PROMPTS.STATIC_INSTRUCTIONS + '\n\n' + followUpDynamicContent;
			} else {
				// No tools requested but still needs analysis - this shouldn't happen in a well-designed prompt
				await this.logger?.logGeneral('warn', 'LLM requested more analysis but no tools', {
					blockIndex,
					iteration
				});

				// Force completion
				return {
					corrections: [],
					interactions
				};
			}
		}

		// Max iterations reached
		await this.logger?.logGeneral('warn', 'Agentic analysis hit max iterations limit', {
			blockIndex,
			maxIterations
		});

		return { corrections: [], interactions };
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
	 * Format segments for LLM input with metadata for analysis
	 */
	private formatSegmentsForLLM(segments: SegmentWithTiming[], prefix?: string): string {
		return segments
			.map((segment) => {
				// Include timing metadata and segment index for ASR tool usage
				const segmentLabel = prefix ? `${prefix}-Segment` : 'Segment';
				let segmentText = `[${segmentLabel} ${segment.index}] ${segment.speakerName || segment.speakerTag || 'Speaker'}: ${segment.text}`;

				// Add timing information if available
				if (typeof segment.startTime === 'number' && typeof segment.endTime === 'number') {
					const duration = segment.endTime - segment.startTime;
					segmentText += `\n[Timing: ${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s (${duration.toFixed(1)}s)]`;
				}

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
	 * Format segments as clean text without metadata for corrections application
	 */
	private formatSegmentsAsCleanText(segments: SegmentWithTiming[]): string {
		return segments
			.map((segment) => {
				// Only include speaker and text - no metadata
				return `${segment.speakerName || segment.speakerTag || 'Speaker'}: ${segment.text}`;
			})
			.join('\n\n');
	}

	/**
	 * Reconstruct corrected text with segment markers for proper parsing during export
	 */
	private async reconstructTextWithSegments(
		originalSegments: SegmentWithTiming[],
		correctedText: string,
		blockIndex: number
	): Promise<string> {
		try {
			// Split the corrected text back into speaker segments
			const correctedSegments = correctedText.split(/\n\s*\n/).filter((segment) => segment.trim());

			await this.logger?.logGeneral('debug', `Reconstructing text with segments`, {
				blockIndex,
				originalSegmentCount: originalSegments.length,
				correctedSegmentCount: correctedSegments.length
			});

			// Map corrected segments back to original segment structure with [Segment N] markers
			const reconstructedSegments = [];

			for (let i = 0; i < Math.min(originalSegments.length, correctedSegments.length); i++) {
				const originalSegment = originalSegments[i];
				const correctedSegment = correctedSegments[i];

				// Extract just the text part from "Speaker: text" format
				const textMatch = correctedSegment.match(/^[^:]+:\s*(.*)$/);
				const text = textMatch ? textMatch[1].trim() : correctedSegment.trim();

				// Reconstruct with segment markers
				let segmentText = `[Segment ${originalSegment.index}] ${originalSegment.speakerName || originalSegment.speakerTag || 'Speaker'}: ${text}`;

				// Add timing information if available
				if (
					typeof originalSegment.startTime === 'number' &&
					typeof originalSegment.endTime === 'number'
				) {
					const duration = originalSegment.endTime - originalSegment.startTime;
					segmentText += `\n[Timing: ${originalSegment.startTime.toFixed(1)}s - ${originalSegment.endTime.toFixed(1)}s (${duration.toFixed(1)}s)]`;
				}

				reconstructedSegments.push(segmentText);
			}

			// Handle any remaining segments (in case counts don't match)
			if (originalSegments.length > correctedSegments.length) {
				// Add remaining original segments unchanged
				for (let i = correctedSegments.length; i < originalSegments.length; i++) {
					const originalSegment = originalSegments[i];
					let segmentText = `[Segment ${originalSegment.index}] ${originalSegment.speakerName || originalSegment.speakerTag || 'Speaker'}: ${originalSegment.text}`;

					if (
						typeof originalSegment.startTime === 'number' &&
						typeof originalSegment.endTime === 'number'
					) {
						const duration = originalSegment.endTime - originalSegment.startTime;
						segmentText += `\n[Timing: ${originalSegment.startTime.toFixed(1)}s - ${originalSegment.endTime.toFixed(1)}s (${duration.toFixed(1)}s)]`;
					}

					reconstructedSegments.push(segmentText);
				}
			} else if (correctedSegments.length > originalSegments.length) {
				// More corrected segments than original - this shouldn't happen, but handle gracefully
				await this.logger?.logGeneral('warn', 'More corrected segments than original segments', {
					blockIndex,
					originalCount: originalSegments.length,
					correctedCount: correctedSegments.length
				});
			}

			const result = reconstructedSegments.join('\n\n');

			await this.logger?.logGeneral('debug', `Text reconstruction completed`, {
				blockIndex,
				resultLength: result.length,
				segmentsReconstructed: reconstructedSegments.length
			});

			return result;
		} catch (error) {
			await this.logger?.logGeneral('error', `Text reconstruction failed`, {
				blockIndex,
				error: error.message
			});

			// Fallback: return the corrected text as-is
			return correctedText;
		}
	}

	/**
	 * Analyze a single block of segments (up to 20)
	 */
	async analyzeBlock(request: WERBlockAnalysisRequest): Promise<WERBlockAnalysisResult> {
		const startTime = Date.now();
		const {
			segments,
			summary,
			blockIndex,
			fileId,
			uiLanguage,
			transcriptFilePath,
			alternativeSegments
		} = request;

		// Initialize logger
		if (transcriptFilePath) {
			this.initializeLogger(transcriptFilePath, fileId);
		}

		// Count segments with alternatives for debugging
		const segmentsWithAlternatives = segments.filter(
			(s) => s.alternatives && s.alternatives.length > 0
		).length;

		await this.logger?.logGeneral('info', `Starting WER block analysis`, {
			blockIndex,
			segmentCount: segments.length,
			segmentRange:
				segments.length > 0
					? `${segments[0]?.index || 0}-${segments[segments.length - 1]?.index || 0}`
					: '0-0',
			segmentsWithAlternatives,
			hasAlternativeSegments: !!alternativeSegments && alternativeSegments.length > 0
		});

		// Assess signal quality for the block (use first and last segments as representative samples)
		let signalQualityInfo = '';
		if (segments.length > 0) {
			try {
				await this.initializeSignalQualityTool();

				if (this.signalQualityTool) {
					// Assess quality of first segment as representative
					const firstSegment = segments[0];
					const qualityData = await this.signalQualityTool.assessSignalQuality({
						audioFilePath: request.audioFilePath || undefined, // Pass audioFilePath if available
						startTime: firstSegment.startTime,
						endTime: firstSegment.endTime
					});

					signalQualityInfo = `\nAUDIO QUALITY CONTEXT:
- SNR: ${qualityData.snr_db?.toFixed(1) || 'unknown'} dB (${qualityData.quality_category || 'unknown'} quality)
- Based on quality, be ${qualityData.quality_category === 'poor' ? 'more conservative' : qualityData.quality_category === 'excellent' ? 'more confident' : 'balanced'} with corrections`;

					await this.logger?.logGeneral('info', 'Signal quality assessed for WER block', {
						blockIndex,
						snrDb: qualityData.snr_db,
						qualityCategory: qualityData.quality_category
					});
				}
			} catch (error) {
				await this.logger?.logGeneral('warn', 'Signal quality assessment failed for WER block', {
					blockIndex,
					error: error.message
				});
				// Continue without signal quality info
			}
		}

		// Normalize language
		const normalizedLanguage = normalizeLanguageCode(uiLanguage);
		const responseLanguage = getLanguageName(normalizedLanguage);

		// Run agentic analysis where LLM can request tools as needed
		const agenticResult = await this.runAgenticAnalysis(
			segments,
			summary,
			signalQualityInfo,
			responseLanguage,
			blockIndex,
			request.audioFilePath,
			alternativeSegments
		);

		const finalCorrections = agenticResult.corrections;

		// Apply corrections to get corrected text
		const originalText = this.formatSegmentsAsCleanText(segments);
		const applyResult = await this.applyCorrections(originalText, finalCorrections, blockIndex);

		// Reconstruct corrected text with segment markers for proper parsing during export
		const correctedTextWithSegments = await this.reconstructTextWithSegments(
			segments,
			applyResult.correctedText,
			blockIndex
		);

		const processingTimeMs = Date.now() - startTime;

		await this.logger?.logGeneral('info', `WER block analysis completed`, {
			blockIndex,
			correctionsFound: finalCorrections.length,
			correctionsApplied: applyResult.appliedCorrections.length,
			conflictedCorrections: applyResult.conflictedCorrections.length,
			processingTimeMs
		});

		// Build interaction history from agentic analysis and clarifications
		const llmInteractions = [
			...agenticResult.interactions,
			...applyResult.clarificationInteractions
		];

		return {
			blockIndex,
			corrections: applyResult.appliedCorrections,
			correctedText: correctedTextWithSegments,
			llmInteractions,
			processingTimeMs
		};
	}

	/**
	 * Analyze entire file in blocks of 20 segments
	 * Supports resuming from interrupted analysis
	 */
	async analyzeFile(request: WERFileAnalysisRequest): Promise<{
		fileId: string;
		totalBlocks: number;
		completedBlocks: number;
		results: WERBlockAnalysisResult[];
	}> {
		const { fileId, editorContent, summary, uiLanguage, transcriptFilePath, originalFilename } =
			request;

		// Initialize logger
		if (transcriptFilePath) {
			this.initializeLogger(transcriptFilePath, fileId);
		}

		await this.logger?.logGeneral('info', 'Starting WER file analysis', {
			fileId,
			originalFilename
		});

		// Load alternative ASR data if available
		let alternativeASR: AlternativeASRResult | null = null;
		if (originalFilename) {
			const alternativeASRPath = getAlternativeASRPath(originalFilename);
			if (alternativeASRPath) {
				alternativeASR = parseAlternativeASRJson(alternativeASRPath);
				if (alternativeASR) {
					await this.logger?.logGeneral('info', 'Alternative ASR data loaded successfully', {
						fileId,
						alternativeASRPath,
						sectionsCount: alternativeASR.sections.length
					});
				}
			}
		}

		// Extract segments from editor content
		const segments = extractSpeakerSegments(editorContent) || [];
		const totalBlocks = Math.ceil(Math.max(1, segments.length) / BLOCK_SIZE);

		// Check for existing completed blocks to resume analysis
		const existingCorrections = await prisma.transcriptCorrection.findMany({
			where: {
				fileId,
				status: 'completed'
			},
			orderBy: { blockIndex: 'asc' }
		});

		const completedBlockIndices = new Set(existingCorrections.map((c) => c.blockIndex));
		const resumeFromBlock = Math.min(
			...Array.from({ length: totalBlocks }, (_, i) => i).filter(
				(i) => !completedBlockIndices.has(i)
			)
		);

		await this.logger?.logGeneral('info', `File analysis plan`, {
			totalSegments: segments.length,
			totalBlocks,
			blockSize: BLOCK_SIZE,
			existingCompletedBlocks: existingCorrections.length,
			resumeFromBlock: isFinite(resumeFromBlock) ? resumeFromBlock : 'none (all complete)'
		});

		// If all blocks are already completed, return existing results
		if (existingCorrections.length >= totalBlocks) {
			await this.logger?.logGeneral(
				'info',
				'All blocks already completed, returning existing results'
			);

			const existingResults: WERBlockAnalysisResult[] = existingCorrections.map((correction) => ({
				blockIndex: correction.blockIndex,
				corrections: correction.suggestions ? JSON.parse(correction.suggestions as string) : [],
				correctedText: correction.correctedText || '',
				llmInteractions: correction.llmInteractions
					? JSON.parse(correction.llmInteractions as string)
					: [],
				processingTimeMs: correction.processingTimeMs || 0
			}));

			return {
				fileId,
				totalBlocks,
				completedBlocks: totalBlocks,
				results: existingResults
			};
		}

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

		const results: WERBlockAnalysisResult[] = [
			...existingCorrections.map((correction) => ({
				blockIndex: correction.blockIndex,
				corrections: correction.suggestions ? JSON.parse(correction.suggestions as string) : [],
				correctedText: correction.correctedText || '',
				llmInteractions: correction.llmInteractions
					? JSON.parse(correction.llmInteractions as string)
					: [],
				processingTimeMs: correction.processingTimeMs || 0
			}))
		];

		// Process each block sequentially (no concurrency), skipping completed ones
		for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
			// Skip already completed blocks
			if (completedBlockIndices.has(blockIndex)) {
				await this.logger?.logGeneral(
					'info',
					`Skipping already completed block ${blockIndex + 1}/${totalBlocks}`,
					{
						blockIndex
					}
				);
				continue;
			}

			const startIdx = blockIndex * BLOCK_SIZE;
			const endIdx = Math.min(startIdx + BLOCK_SIZE, segments.length);
			const blockSegments = segments.slice(startIdx, endIdx);

			try {
				await this.logger?.logGeneral('info', `Processing block ${blockIndex + 1}/${totalBlocks}`, {
					blockIndex,
					segmentRange: `${startIdx}-${endIdx - 1}`,
					segmentCount: blockSegments.length,
					resuming: existingCorrections.length > 0
				});

				// Extract alternative segments for this block's timeframe if available
				let alternativeBlockSegments: SegmentWithTiming[] | undefined = undefined;
				if (alternativeASR && blockSegments.length > 0) {
					const validStartTimes = blockSegments
						.map((s) => s.startTime)
						.filter((t) => typeof t === 'number' && !isNaN(t) && isFinite(t));
					const validEndTimes = blockSegments
						.map((s) => s.endTime)
						.filter((t) => typeof t === 'number' && !isNaN(t) && isFinite(t));

					if (validStartTimes.length > 0 && validEndTimes.length > 0) {
						const blockStartTime = Math.min(...validStartTimes);
						const blockEndTime = Math.max(...validEndTimes);

						if (blockStartTime < blockEndTime) {
							alternativeBlockSegments = extractAlternativeSegments(
								alternativeASR,
								blockStartTime,
								blockEndTime
							);

							await this.logger?.logGeneral(
								'info',
								`Extracted alternative segments for block ${blockIndex + 1}`,
								{
									blockIndex,
									blockTimeframe: `${blockStartTime.toFixed(1)}s - ${blockEndTime.toFixed(1)}s`,
									mainSegmentsCount: blockSegments.length,
									alternativeSegmentsCount: alternativeBlockSegments.length
								}
							);
						} else {
							await this.logger?.logGeneral('warn', 'Invalid time range for alternative segments', {
								blockIndex,
								blockStartTime,
								blockEndTime
							});
							alternativeBlockSegments = [];
						}
					} else {
						await this.logger?.logGeneral(
							'warn',
							'No valid time data found for alternative segments',
							{
								blockIndex,
								validStartTimes: validStartTimes.length,
								validEndTimes: validEndTimes.length
							}
						);
						alternativeBlockSegments = [];
					}
				}

				// Analyze this block
				const blockResult = await this.analyzeBlock({
					fileId,
					segments: blockSegments,
					summary,
					blockIndex,
					uiLanguage,
					transcriptFilePath,
					alternativeSegments: alternativeBlockSegments
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
