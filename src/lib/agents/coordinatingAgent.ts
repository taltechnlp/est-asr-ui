import {
	createOpenRouterChat,
	DEFAULT_MODEL,
	DEFAULT_MODEL_NAME,
	OPENROUTER_MODELS
} from '$lib/llm/openrouter-direct';
import { HumanMessage } from '@langchain/core/messages';
import { createWebSearchTool } from './tools';
// ASR tool will be loaded conditionally to avoid client-side issues
import { TipTapTransactionToolDirect } from './tools/tiptapTransaction';
import type { TranscriptSummary, AnalysisSegment } from '@prisma/client';
import { prisma } from '$lib/db/client';
import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
import type { Editor } from '@tiptap/core';
import { getLanguageName, normalizeLanguageCode } from '$lib/utils/language';
import { createEditorSnapshot, searchInSnapshot } from '$lib/services/editorDebugger';
import { runAutomatedTestSuite } from '$lib/services/textReplacementTestHarness';
import {
	robustJsonParse,
	formatParsingErrorForLLM,
	validateJsonStructure
} from './utils/jsonParser';
import { getAgentFileLogger, type AgentFileLogger } from '$lib/utils/agentFileLogger';
import { getPrompts, type PromptStrategy } from './prompts';

export interface SegmentAnalysisRequest {
	fileId: string;
	segment: SegmentWithTiming;
	summary: TranscriptSummary;
	audioFilePath: string;
	transcriptFilePath?: string;
	uiLanguage?: string;
}

export interface SegmentAnalysisResult {
	segmentIndex: number;
	analysis: string;
	correctedSegment?: string | null;
	suggestions: any[];
	nBestResults?: any;
	confidence: number;
	signalQuality?: any;
	analysisStrategy?: string;
	dynamicConfidenceThreshold?: number;
}

// Prompts are now loaded from external files via getPrompts() function

export class CoordinatingAgent {
	private model;
	private fallbackModel;
	private primaryModelName: string;
	private asrTool: any = null;
	private phoneticTool: any = null;
	private signalQualityTool: any = null;
	private webSearchTool;
	private tiptapTool: TipTapTransactionToolDirect;
	private editor: Editor | null = null;
	private debugMode: boolean = false;
	private logger: AgentFileLogger | null = null;
	private promptStrategy: PromptStrategy = 'legacy';
	private prompts: ReturnType<typeof getPrompts>;

	constructor(modelName: string = DEFAULT_MODEL, promptStrategy: PromptStrategy = 'legacy') {
		this.primaryModelName = modelName;
		this.model = createOpenRouterChat({
			modelName,
			temperature: 0.3,
			maxTokens: 2000
		});

		// Create fallback model (GPT-4o) if primary model is different
		const fallbackModelName = OPENROUTER_MODELS.GPT_4O;
		if (modelName !== fallbackModelName) {
			this.fallbackModel = createOpenRouterChat({
				modelName: fallbackModelName,
				temperature: 0.3,
				maxTokens: 2000
			});
		}

		// Set prompt strategy and load corresponding prompts
		this.promptStrategy = promptStrategy;
		this.prompts = getPrompts(promptStrategy);

		// The ASR, phonetic, and signal quality tools will be loaded lazily when needed (server-side only)
		this.webSearchTool = createWebSearchTool();
		this.tiptapTool = new TipTapTransactionToolDirect();
	}

	/**
	 * Clean text by removing speaker tags for phonetic analysis
	 * Speaker tags like "SPEAKER_01: " or "Speaker: " should not be analyzed phonetically
	 *
	 * Examples:
	 * "SPEAKER_01: mõtteid, mida" -> "mõtteid, mida"
	 * "Kas veel\n\nSPEAKER_01: On" -> "Kas veel On"
	 */
	private cleanTextForPhoneticAnalysis(text: string): string {
		if (!text) return text;

		// Remove speaker patterns: SPEAKER_XX:, Speaker:, etc.
		// Also handle newlines and multiple spaces
		return text
			.replace(/SPEAKER_\d+:\s*/gi, '') // Remove SPEAKER_01:, SPEAKER_02:, etc.
			.replace(/Speaker:\s*/gi, '') // Remove Speaker:
			.replace(/^\s*[\w\s]+:\s*/gm, '') // Remove any "Name: " pattern at line start
			.replace(/\n+/g, ' ') // Replace newlines with spaces
			.replace(/\s+/g, ' ') // Normalize multiple spaces
			.trim();
	}

	/**
	 * Invoke model with automatic fallback to Claude 3.5 Sonnet on empty responses
	 */
	private async invokeWithFallback(messages: any[], segmentIndex?: number): Promise<any> {
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
					`Primary model ${this.primaryModelName} failed with empty response, falling back to GPT-4o`,
					{ error: error.message },
					segmentIndex
				);

				try {
					const fallbackResponse = await this.fallbackModel.invoke(messages);
					await this.logger?.logGeneral(
						'info',
						'Successfully fell back to GPT-4o',
						{ responseLength: (fallbackResponse.content as string).length },
						segmentIndex
					);
					return fallbackResponse;
				} catch (fallbackError: any) {
					await this.logger?.logGeneral(
						'error',
						'Both primary and fallback models failed',
						{
							primaryError: error.message,
							fallbackError: fallbackError.message
						},
						segmentIndex
					);
					throw new Error(
						`Both ${this.primaryModelName} and GPT-4o failed: ${fallbackError.message}`
					);
				}
			}

			// Re-throw non-empty response errors
			throw error;
		}
	}

	private async initializeASRTool() {
		if (this.asrTool) return;

		// Only load on server side
		if (typeof window === 'undefined') {
			try {
				const { createASRNBestServerNodeTool } = await import('./tools/asrNBestServerNode');
				this.asrTool = createASRNBestServerNodeTool(
					'https://tekstiks.ee/asr/transcribe/alternatives'
				);
			} catch (e) {
				await this.logger?.logGeneral('warn', 'Failed to load ASR tool', { error: e });
			}
		}
	}

	private async initializePhoneticTool() {
		if (this.phoneticTool) return;

		// Only load on server side
		if (typeof window === 'undefined') {
			try {
				const { createPhoneticAnalyzerTool } = await import('./tools/phoneticAnalyzer');
				this.phoneticTool = createPhoneticAnalyzerTool();
				await this.logger?.logGeneral('info', 'PhoneticAnalyzerTool initialized successfully');
			} catch (e) {
				await this.logger?.logGeneral('warn', 'Failed to load PhoneticAnalyzer tool', { error: e });
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
				await this.logger?.logGeneral('info', 'SignalQualityAssessorTool initialized successfully');
			} catch (e) {
				await this.logger?.logGeneral('warn', 'Failed to load SignalQualityAssessor tool', {
					error: e
				});
			}
		}
	}

	setEditor(editor: Editor) {
		this.editor = editor;
		this.tiptapTool.setEditor(editor);
	}

	setDebugMode(enabled: boolean) {
		this.debugMode = enabled;
	}

	/**
	 * Set the prompt strategy and reload prompts
	 */
	setPromptStrategy(strategy: PromptStrategy) {
		this.promptStrategy = strategy;
		this.prompts = getPrompts(strategy);
	}

	/**
	 * Get current prompt strategy
	 */
	getPromptStrategy(): PromptStrategy {
		return this.promptStrategy;
	}

	private initializeLogger(transcriptFilePath: string, fileId: string): void {
		if (!this.logger && transcriptFilePath) {
			this.logger = getAgentFileLogger(transcriptFilePath, fileId);
		}
	}

	async runTests() {
		if (!this.editor) {
			throw new Error('Editor not set');
		}
		await runAutomatedTestSuite(this.editor);
	}

	debugSearchText(searchText: string) {
		if (!this.editor) {
			this.logger?.logGeneral('error', 'Editor not set for debug search');
			return;
		}

		const snapshot = createEditorSnapshot(this.editor);
		const results = searchInSnapshot(snapshot, searchText);

		this.logger?.logGeneral('debug', `Debug search for "${searchText}"`, {
			results,
			exactMatch: results.exactMatch,
			found: results.found,
			locations: results.exactMatch ? results.locations.map((l) => l.position) : undefined,
			foundWords: results.wordAnalysis?.foundWords,
			missingWords: results.wordAnalysis?.missingWords
		});
		return results;
	}

	private cleanJsonString(str: string): string {
		// Remove control characters except for valid JSON whitespace
		return (
			str
				.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
				// Also remove any non-breaking spaces that might cause issues
				.replace(/\u00A0/g, ' ')
				// Normalize quotes
				.replace(/[\u2018\u2019]/g, "'")
				.replace(/[\u201C\u201D]/g, '"')
		);
	}

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

			const singleNeedsAlternativesField =
				this.promptStrategy === 'no_secondary_asr' ? '' : '\n  "needsAlternatives": true or false,';

			const correctionPrompt = `${formatParsingErrorForLLM(
				parseResult.error || 'Invalid JSON structure',
				response
			)}

Please provide ONLY valid JSON that matches this exact structure:
{
  "analysis": "string - your analysis text",
  "confidence": 0.0 to 1.0,${singleNeedsAlternativesField}
  "needsWebSearch": ["array", "of", "search", "terms"] or [],
  "suggestions": [
    {
      "type": "one of: grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "one of: low|medium|high",
      "text": "description of the issue",
      "originalText": "exact text to replace",
      "suggestedText": "replacement text",
      "confidence": 0.0 to 1.0
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No explanations, no text before or after, no markdown code blocks.`;

			await this.logger?.logGeneral('debug', 'Sending correction prompt to LLM');

			try {
				const correctedResponse = await this.invokeWithFallback([
					new HumanMessage({ content: correctionPrompt })
				]);

				const correctedContent = correctedResponse.content as string;
				await this.logger?.logGeneral('debug', 'LLM correction response received', {
					responseLength: correctedContent.length
				});

				const retryResult = robustJsonParse(correctedContent);

				if (retryResult.success) {
					await this.logger?.logGeneral('debug', `JSON parsed successfully on retry ${retry}`, {
						fixesApplied: retryResult.fixesApplied
					});
					return retryResult.data;
				} else {
					await this.logger?.logGeneral('warn', `Retry ${retry} failed`, {
						error: retryResult.error
					});
				}
			} catch (error) {
				await this.logger?.logGeneral('error', `Retry ${retry} error`, { error });
			}
		}

		// Fallback after all retries failed
		await this.logger?.logGeneral(
			'error',
			'All JSON parsing attempts failed, using fallback structure'
		);

		return {
			analysis: response.substring(0, 1000),
			confidence: 0.5,
			needsAlternatives: true,
			needsWebSearch: [],
			suggestions: []
		};
	}

	async analyzeSegment(request: SegmentAnalysisRequest): Promise<SegmentAnalysisResult> {
		try {
			const { segment, summary, audioFilePath, fileId, uiLanguage, transcriptFilePath } = request;

			// Initialize logger if transcript path is provided
			if (transcriptFilePath) {
				this.initializeLogger(transcriptFilePath, fileId);
				await this.logger?.logGeneral(
					'info',
					`Starting analysis for segment ${segment.index}`,
					{
						segmentText: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
						fullSegmentText: segment.text, // Full text to see punctuation issues
						textEndsWithPunctuation: /[.!?]$/.test(segment.text.trim()),
						textLastChar: segment.text.trim().charAt(segment.text.trim().length - 1),
						speaker: segment.speakerName || segment.speakerTag,
						duration: (segment.endTime - segment.startTime).toFixed(2) + 's'
					},
					segment.index
				);
			}

			// Normalize UI language and get language name
			const normalizedLanguage = normalizeLanguageCode(uiLanguage);
			const responseLanguage = getLanguageName(normalizedLanguage);

			// Debug logging for language detection
			await this.logger?.logGeneral('debug', 'Language detection for analysis', {
				originalUiLanguage: uiLanguage,
				normalizedLanguage,
				responseLanguage,
				segmentIndex: segment.index
			});

			// Step 1: Assess signal quality to guide analysis strategy
			let signalQuality = null;
			let analysisStrategy = 'balanced';
			let dynamicConfidenceThreshold = 0.7;

			try {
				await this.logger?.logGeneral('info', 'Assessing signal quality for analysis strategy', {
					segmentIndex: segment.index
				});

				// Initialize signal quality tool if needed
				await this.initializeSignalQualityTool();

				if (this.signalQualityTool) {
					const signalQualityStartTime = Date.now();
					const qualityInput = {
						audioFilePath,
						startTime: segment.startTime,
						endTime: segment.endTime
					};

					await this.logger?.logToolCall('SignalQualityAssessor', qualityInput, segment.index);

					const qualityData = await this.signalQualityTool.assessSignalQuality(qualityInput);

					const signalQualityDuration = Date.now() - signalQualityStartTime;
					await this.logger?.logToolResponse(
						'SignalQualityAssessor',
						qualityData,
						signalQualityDuration,
						segment.index
					);

					signalQuality = qualityData;

					// Get analysis strategy based on SNR
					const strategy = this.signalQualityTool.getAnalysisStrategy(qualityData.snr_db);
					analysisStrategy = strategy.strategy;
					dynamicConfidenceThreshold = strategy.confidenceThreshold;

					await this.logger?.logGeneral(
						'info',
						'Signal quality assessment completed',
						{
							snrDb: qualityData.snr_db,
							qualityCategory: qualityData.quality_category,
							strategy: analysisStrategy,
							dynamicThreshold: dynamicConfidenceThreshold
						},
						segment.index
					);
				} else {
					await this.logger?.logGeneral(
						'info',
						'Signal quality tool not available, using default strategy',
						{},
						segment.index
					);
				}
			} catch (qualityError) {
				// Error logged by logger below
				await this.logger?.logGeneral(
					'error',
					'Signal quality assessment failed',
					qualityError,
					segment.index
				);
				// Continue with default strategy
			}

			// Build alternatives section if available
			let alternativesSection = '';
			if (segment.alternatives && segment.alternatives.length > 0) {
				const alternativesText = segment.alternatives
					.map((alt, idx) => `${idx + 1}. ${alt.text} (confidence: ${alt.avg_logprob.toFixed(3)})`)
					.join('\n');

				alternativesSection = `Alternative transcriptions available:
${alternativesText}

Consider these alternatives when analyzing for potential transcription errors.`;
			}

			// Build signal quality section for prompt
			let signalQualitySection = '';
			if (signalQuality) {
				signalQualitySection = `\nSignal Quality Assessment:
- SNR: ${signalQuality.snr_db.toFixed(2)} dB (${signalQuality.quality_category} quality)
- Reliability: ${signalQuality.reliability}
- Analysis Strategy: ${analysisStrategy}
- Recommended confidence threshold: ${dynamicConfidenceThreshold}

Based on this audio quality, you should be ${
					analysisStrategy === 'conservative'
						? 'very conservative'
						: analysisStrategy === 'aggressive'
							? 'more aggressive'
							: analysisStrategy === 'very_aggressive'
								? 'very aggressive'
								: 'balanced'
				} with corrections.`;
			}

			// Build the analysis prompt using current strategy
			const prompt = this.prompts.SEGMENT_ANALYSIS_PROMPT.replace('{summary}', summary.summary)
				.replace('{segmentIndex}', (segment.index + 1).toString())
				.replace('{totalSegments}', 'TBD')
				.replace(/\{speaker\}/g, segment.speakerName || segment.speakerTag) // Replace all occurrences
				.replace('{text}', segment.text)
				.replace('{duration}', (segment.endTime - segment.startTime).toFixed(2))
				.replace('{wordCount}', segment.words.length.toString())
				.replace('{alternativesSection}', alternativesSection + signalQualitySection)
				.replace('{responseLanguage}', responseLanguage);

			// Log the analysis request
			await this.logger?.logGeneral(
				'info',
				'Starting LLM analysis request',
				{
					speaker: segment.speakerName || segment.speakerTag,
					textLength: segment.text.length,
					duration: (segment.endTime - segment.startTime).toFixed(2) + 's',
					alternativesCount: segment.alternatives ? segment.alternatives.length : 0,
					alternativeTexts: segment.alternatives?.map((alt) => alt.text) || []
				},
				segment.index
			);

			// Get initial analysis
			const llmStartTime = Date.now();
			await this.logger?.logLLMRequest(prompt, DEFAULT_MODEL_NAME, segment.index);

			const response = await this.invokeWithFallback(
				[new HumanMessage({ content: prompt })],
				segment.index
			);

			const llmDuration = Date.now() - llmStartTime;
			await this.logger?.logLLMResponse(response.content as string, llmDuration, segment.index);

			await this.logger?.logGeneral(
				'debug',
				'Processing LLM response',
				{
					responseLength: (response.content as string).length
				},
				segment.index
			);

			// Parse the response with robust error recovery and retry
			const expectedKeys =
				this.promptStrategy === 'no_secondary_asr'
					? ['analysis', 'confidence', 'needsWebSearch', 'suggestions']
					: ['analysis', 'confidence', 'needsAlternatives', 'needsWebSearch', 'suggestions'];
			const analysisData = await this.parseResponseWithRetry(
				response.content as string,
				expectedKeys
			);

			await this.logger?.logGeneral(
				'debug',
				'Analysis data extracted successfully',
				{
					suggestionsCount: analysisData.suggestions?.length || 0
				},
				segment.index
			);

			let nBestResults = null;

			// Use ASR N-best tool when the LLM determines it's needed OR when signal quality is poor
			// Skip ASR entirely for no_secondary_asr strategy
			const shouldUseASR =
				this.promptStrategy !== 'no_secondary_asr' &&
				(analysisData.needsAlternatives || (signalQuality && signalQuality.snr_db < 15)); // Aggressive ASR for poor audio

			if (shouldUseASR) {
				let asrStartTime: number;
				try {
					// Initialize ASR tool if not already done
					await this.initializeASRTool();

					if (this.asrTool) {
						await this.logger?.logToolExecution(
							'ASRNBestTool',
							'Calling ASR N-best tool for segment',
							{
								audioFilePath: audioFilePath?.split('/').pop() || 'unknown',
								startTime: segment.startTime,
								endTime: segment.endTime
							},
							segment.index
						);

						asrStartTime = Date.now();
						const asrInput = {
							audioFilePath,
							startTime: segment.startTime,
							endTime: segment.endTime,
							nBest: 5
						};

						await this.logger?.logToolCall('ASR-NBest', asrInput, segment.index);

						const asrResult = await this.asrTool._call(asrInput);

						const asrDuration = Date.now() - asrStartTime;
						nBestResults = JSON.parse(asrResult);
						await this.logger?.logToolResponse(
							'ASR-NBest',
							nBestResults,
							asrDuration,
							segment.index
						);

						await this.logger?.logToolExecution(
							'ASRNBestTool',
							'ASR N-best results received',
							{
								resultCount: nBestResults?.alternatives?.length || 0
							},
							segment.index
						);
					} else {
						await this.logger?.logToolExecution(
							'ASRNBestTool',
							'ASR tool not available (client-side context)',
							{},
							segment.index
						);
					}
				} catch (e) {
					await this.logger?.logToolError('ASRNBestTool', e, 0, segment.index);
					const asrDuration = Date.now() - (asrStartTime || Date.now());
					await this.logger?.logToolError('ASR-NBest', e, asrDuration, segment.index);
				}
			}

			// If we have ASR results, perform enhanced analysis
			if (nBestResults && nBestResults.alternatives && nBestResults.alternatives.length > 0) {
				try {
					await this.logger?.logGeneral('info', 'Performing enhanced analysis with ASR results', {
						speaker: segment.speakerName,
						originalText: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
						alternativeCount: nBestResults?.alternatives?.length || 0,
						segmentIndex: segment.index
					});

					// Format ASR alternatives for the prompt
					const asrAlternativesText = nBestResults.alternatives
						.map(
							(alt: any, idx: number) =>
								`${idx + 1}. ${alt.text} (confidence: ${alt.confidence || 'N/A'})`
						)
						.join('\n');

					// Create enhanced analysis prompt using current strategy
					const enhancedPrompt = this.prompts.ENHANCED_ANALYSIS_PROMPT.replace(
						'{originalText}',
						segment.text
					)
						.replace('{initialAnalysis}', JSON.stringify(analysisData.suggestions || []))
						.replace('{asrAlternatives}', asrAlternativesText)
						.replace('{responseLanguage}', responseLanguage);

					await this.logger?.logGeneral('debug', 'Sending enhanced prompt to LLM', {
						segmentIndex: segment.index
					});

					// Get enhanced analysis
					const enhancedLlmStartTime = Date.now();
					await this.logger?.logLLMRequest(
						enhancedPrompt,
						`${DEFAULT_MODEL_NAME} (Enhanced Analysis)`,
						segment.index
					);

					const enhancedResponse = await this.invokeWithFallback(
						[new HumanMessage({ content: enhancedPrompt })],
						segment.index
					);

					const enhancedLlmDuration = Date.now() - enhancedLlmStartTime;
					await this.logger?.logLLMResponse(
						enhancedResponse.content as string,
						enhancedLlmDuration,
						segment.index
					);

					await this.logger?.logGeneral('debug', 'Enhanced response received', {
						responseLength: (enhancedResponse.content as string).length,
						segmentIndex: segment.index
					});

					// Parse enhanced response with retry mechanism
					const enhancedExpectedKeys =
						this.promptStrategy === 'no_secondary_asr'
							? ['analysis', 'confidence', 'needsWebSearch', 'suggestions']
							: ['analysis', 'confidence', 'needsAlternatives', 'needsWebSearch', 'suggestions'];
					const enhancedData = await this.parseResponseWithRetry(
						enhancedResponse.content as string,
						enhancedExpectedKeys
					);

					if (enhancedData.suggestions && enhancedData.suggestions.length > 0) {
						await this.logger?.logGeneral('info', 'Enhanced analysis successful', {
							suggestionsCount: enhancedData.suggestions.length,
							segmentIndex: segment.index
						});
						// Update analysis data with enhanced suggestions
						analysisData.suggestions = enhancedData.suggestions;
						analysisData.analysis = enhancedData.analysis || analysisData.analysis;
						analysisData.confidence = enhancedData.confidence || analysisData.confidence;
					} else {
						await this.logger?.logGeneral('warn', 'Enhanced analysis produced no suggestions', {
							segmentIndex: segment.index
						});
					}
				} catch (e) {
					await this.logger?.logGeneral('error', 'Enhanced analysis error', {
						error: e,
						segmentIndex: segment.index
					});
				}
			} else {
				await this.logger?.logGeneral('info', 'No ASR results available for enhanced analysis', {
					segmentIndex: segment.index
				});
			}

			// Perform phonetic analysis on high-confidence suggestions
			if (
				analysisData.suggestions &&
				Array.isArray(analysisData.suggestions) &&
				analysisData.suggestions.length > 0
			) {
				try {
					await this.logger?.logGeneral('info', 'Performing phonetic analysis on suggestions', {
						segmentIndex: segment.index
					});

					// Initialize phonetic tool if needed
					await this.initializePhoneticTool();

					if (this.phoneticTool) {
						// Analyze each suggestion that has both original and suggested text
						for (const suggestion of analysisData.suggestions) {
							if (suggestion.originalText && suggestion.suggestedText) {
								let phoneticStartTime: number;
								try {
									await this.logger?.logToolExecution(
										'PhoneticAnalyzer',
										'Analyzing phonetic similarity',
										{
											original: suggestion.originalText?.substring(0, 100),
											suggested: suggestion.suggestedText?.substring(0, 100)
										},
										segment.index
									);

									phoneticStartTime = Date.now();
									const phoneticInput = {
										text: this.cleanTextForPhoneticAnalysis(suggestion.originalText),
										candidate: this.cleanTextForPhoneticAnalysis(suggestion.suggestedText)
									};

									await this.logger?.logToolCall('PhoneticAnalyzer', phoneticInput, segment.index);

									const phoneticData =
										await this.phoneticTool.analyzePhoneticSimilarity(phoneticInput);

									const phoneticDuration = Date.now() - phoneticStartTime;
									await this.logger?.logToolResponse(
										'PhoneticAnalyzer',
										phoneticData,
										phoneticDuration,
										segment.index
									);

									// Enhance suggestion with phonetic analysis
									suggestion.phoneticAnalysis = {
										similarity_score: phoneticData.similarity_score,
										confidence: phoneticData.confidence,
										is_likely_asr_error: phoneticData.is_likely_asr_error,
										original_phonetic: phoneticData.original_phonetic,
										candidate_phonetic: phoneticData.candidate_phonetic
									};

									// Boost confidence for high phonetic similarity
									if (phoneticData.similarity_score >= 0.7) {
										const originalConfidence = suggestion.confidence || 0.5;
										const phoneticBoost = (phoneticData.similarity_score - 0.7) * 0.5; // 0.0 to 0.15 boost
										suggestion.confidence = Math.min(1.0, originalConfidence + phoneticBoost);

										// Add explanation about phonetic similarity
										const phoneticExplanation = `Phonetic analysis shows ${Math.round(phoneticData.similarity_score * 100)}% similarity, suggesting this could be an ASR error.`;
										suggestion.explanation = suggestion.explanation
											? `${suggestion.explanation} ${phoneticExplanation}`
											: phoneticExplanation;

										await this.logger?.logToolExecution(
											'PhoneticAnalyzer',
											'Phonetic boost applied',
											{
												originalConfidence: originalConfidence,
												newConfidence: suggestion.confidence,
												similarityScore: phoneticData.similarity_score
											},
											segment.index
										);
									} else {
										await this.logger?.logToolExecution(
											'PhoneticAnalyzer',
											'Low phonetic similarity, no confidence boost',
											{
												similarityScore: phoneticData.similarity_score
											},
											segment.index
										);
									}
								} catch (phoneticError) {
									await this.logger?.logToolError(
										'PhoneticAnalyzer',
										phoneticError,
										0,
										segment.index
									);
									const phoneticErrorDuration = Date.now() - phoneticStartTime;
									await this.logger?.logToolError(
										'PhoneticAnalyzer',
										phoneticError,
										phoneticErrorDuration,
										segment.index
									);
									// Continue with other suggestions even if one fails
								}
							}
						}
					} else {
						await this.logger?.logGeneral(
							'info',
							'Phonetic tool not available, skipping phonetic analysis',
							{ segmentIndex: segment.index }
						);
					}
				} catch (phoneticError) {
					await this.logger?.logGeneral('error', 'Phonetic analysis error', {
						error: phoneticError,
						segmentIndex: segment.index
					});
					// Don't fail the entire analysis if phonetic analysis fails
				}
			}

			// Use web search for unfamiliar terms
			if (analysisData.needsWebSearch && analysisData.needsWebSearch.length > 0) {
				for (const term of analysisData.needsWebSearch) {
					try {
						const searchResult = await this.webSearchTool._call({
							query: term,
							language: summary.language
						});
						// Could enhance analysis with search results
						await this.logger?.logToolExecution(
							'WebSearch',
							`Web search for "${term}"`,
							{ results: searchResult },
							segment.index
						);
					} catch (e) {
						await this.logger?.logToolError('WebSearch', e, 0, segment.index);
					}
				}
			}

			// Process suggestions - mark them for automatic application on client-side
			const processedSuggestions = [];
			if (analysisData.suggestions && Array.isArray(analysisData.suggestions)) {
				for (const suggestion of analysisData.suggestions) {
					// Compute positions for the suggestion within the segment text
					let from: number | undefined;
					let to: number | undefined;

					if (suggestion.originalText && segment.text) {
						// Find the position of the original text in the segment
						const segmentText = segment.text;
						const searchText = suggestion.originalText;

						// Try exact match first
						let index = segmentText.indexOf(searchText);

						// If not found, try case-insensitive search
						if (index === -1) {
							const lowerSegment = segmentText.toLowerCase();
							const lowerSearch = searchText.toLowerCase();
							index = lowerSegment.indexOf(lowerSearch);
						}

						if (index !== -1) {
							// Found the text - compute positions
							// These are character positions within the segment text
							from = index;
							to = index + searchText.length;
							await this.logger?.logGeneral(
								'debug',
								'Found position for suggestion',
								{
									text: searchText.substring(0, 50),
									position: [from, to]
								},
								segment.index
							);
						} else {
							await this.logger?.logGeneral(
								'warn',
								'Could not find position for suggestion',
								{
									text: searchText.substring(0, 50)
								},
								segment.index
							);
						}
					}

					// Mark high-confidence suggestions for automatic application
					// These will be applied as diff nodes on the client-side
					// Use dynamic confidence threshold based on signal quality
					const autoApplyThreshold = Math.max(0.5, dynamicConfidenceThreshold - 0.2); // Slightly lower than analysis threshold
					if (
						suggestion.confidence >= autoApplyThreshold &&
						suggestion.originalText &&
						suggestion.suggestedText
					) {
						processedSuggestions.push({
							...suggestion,
							from, // Character position in segment
							to, // Character position in segment
							segmentIndex: segment.index, // Which segment this belongs to
							shouldAutoApply: true,
							applied: false,
							requiresManualReview: false
						});
						await this.logger?.logGeneral(
							'info',
							'Marked for auto-apply',
							{
								original: suggestion.originalText?.substring(0, 50),
								suggested: suggestion.suggestedText?.substring(0, 50),
								confidence: suggestion.confidence
							},
							segment.index
						);
					} else {
						// Low confidence suggestions require manual review
						processedSuggestions.push({
							...suggestion,
							from,
							to,
							segmentIndex: segment.index,
							shouldAutoApply: false,
							applied: false,
							requiresManualReview: true
						});
						await this.logger?.logGeneral(
							'info',
							'Marked for manual review',
							{
								original: suggestion.originalText?.substring(0, 50),
								suggested: suggestion.suggestedText?.substring(0, 50),
								confidence: suggestion.confidence
							},
							segment.index
						);
					}
				}

				await this.logger?.logGeneral('info', 'Suggestions processing complete', {
					totalSuggestions: processedSuggestions.length,
					autoApply: processedSuggestions.filter((s) => s.shouldAutoApply).length,
					manualReview: processedSuggestions.filter((s) => s.requiresManualReview).length,
					segmentIndex: segment.index
				});
			}

			// Save to database
			await prisma.analysisSegment.upsert({
				where: {
					fileId_segmentIndex: {
						fileId,
						segmentIndex: segment.index
					}
				},
				create: {
					fileId,
					segmentIndex: segment.index,
					startTime: segment.startTime,
					endTime: segment.endTime,
					startWord: segment.startWord,
					endWord: segment.endWord,
					originalText: segment.text,
					correctedSegment: analysisData.correctedSegment || null,
					speakerName: segment.speakerName || segment.speakerTag,
					analysis: analysisData.analysis,
					suggestions:
						processedSuggestions.length > 0 ? processedSuggestions : analysisData.suggestions,
					nBestResults,
					status: 'analyzed'
				},
				update: {
					correctedSegment: analysisData.correctedSegment || null,
					speakerName: segment.speakerName || segment.speakerTag,
					analysis: analysisData.analysis,
					suggestions:
						processedSuggestions.length > 0 ? processedSuggestions : analysisData.suggestions,
					nBestResults,
					status: 'analyzed'
				}
			});

			// Log successful completion
			await this.logger?.logGeneral(
				'info',
				`Completed analysis for segment ${segment.index}`,
				{
					suggestionsCount:
						processedSuggestions.length > 0
							? processedSuggestions.length
							: analysisData.suggestions?.length || 0,
					confidence: analysisData.confidence,
					strategy: analysisStrategy,
					hasASRResults: !!nBestResults,
					hasSignalQuality: !!signalQuality
				},
				segment.index
			);

			return {
				segmentIndex: segment.index,
				analysis: analysisData.analysis,
				suggestions:
					processedSuggestions.length > 0 ? processedSuggestions : analysisData.suggestions,
				nBestResults,
				confidence: analysisData.confidence,
				signalQuality,
				analysisStrategy,
				dynamicConfidenceThreshold
			};
		} catch (error) {
			await this.logger?.logGeneral('error', 'Analysis failed for segment', { error });
			throw new Error(
				`Failed to analyze segment: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	async getAnalyzedSegments(fileId: string): Promise<AnalysisSegment[]> {
		return prisma.analysisSegment.findMany({
			where: { fileId },
			orderBy: { segmentIndex: 'asc' }
		});
	}

	async applySuggestionManually(
		suggestion: any,
		segmentId?: string
	): Promise<{ success: boolean; error?: string }> {
		try {
			if (!suggestion.originalText || !suggestion.suggestedText) {
				return { success: false, error: 'Missing original or suggested text' };
			}

			const result = await this.tiptapTool.applyTransaction({
				originalText: suggestion.originalText,
				suggestedText: suggestion.suggestedText,
				segmentId: segmentId,
				changeType: suggestion.type || 'text_replacement',
				confidence: suggestion.confidence || 0.5,
				context: suggestion.text || suggestion.explanation || ''
			});

			const parseResult = robustJsonParse(result);
			if (parseResult.success) {
				return parseResult.data;
			} else {
				await this.logger?.logGeneral('error', 'Failed to parse transaction result', {
					error: parseResult.error
				});
				return {
					success: false,
					error: `JSON parsing failed: ${parseResult.error}`
				};
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Singleton instance
let coordinatingAgentInstance: CoordinatingAgent | null = null;

export function getCoordinatingAgent(
	modelName?: string,
	promptStrategy?: PromptStrategy
): CoordinatingAgent {
	if (!coordinatingAgentInstance || modelName || promptStrategy) {
		coordinatingAgentInstance = new CoordinatingAgent(modelName, promptStrategy);
	}
	return coordinatingAgentInstance;
}
