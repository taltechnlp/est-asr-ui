import { createOpenRouterChat, OPENROUTER_MODELS } from '$lib/llm/openrouter-direct';
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
	suggestions: any[];
	nBestResults?: any;
	confidence: number;
	signalQuality?: any;
	analysisStrategy?: string;
	dynamicConfidenceThreshold?: number;
}

export interface MultiSegmentAnalysisRequest {
	fileId: string;
	segments: SegmentWithTiming[]; // Up to 5 segments
	summary: TranscriptSummary;
	audioFilePath: string;
	transcriptFilePath?: string;
	uiLanguage?: string;
}

export interface MultiSegmentAnalysisResult {
	results: SegmentAnalysisResult[];
	overallAnalysis: string;
}

const SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert transcript analyst specializing in Estonian language.

Context from full transcript summary:
{summary}

Current speaker segment to analyze (speaker turn {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds
Word count: {wordCount} words

ASR N-best list: {alternativesSection}

This is a complete speaker turn - analyze the entire utterance from {speaker}.

Your task (REMEMBER: respond only in {responseLanguage}):
1. Analyze this complete speaker turn for quality, accuracy, and coherence
2. Consider the context from the full transcript summary
3. Identify potential transcription errors or unclear passages within this speaker's utterance
4. Provide specific improvement suggestions for this speaker's turn. Do not suggest speaker labeling changes

Focus on:
- Grammar and language correctness throughout the speaker's turn
- Internal coherence within this speaker's utterance
- Consistency with the overall transcript context
- Proper nouns and technical terms accuracy
- Natural speech patterns
- Punctuation and formatting
- Phonetic plausibility of words (especially for potential homophones or ASR errors)

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText and suggestedText SHORT and FOCUSED (typically 1-5 words, maximum 1-2 sentences)
- Target only the specific problematic part, not entire sentences or paragraphs
- Focus on the minimal text span that needs correction
- Avoid copying large portions of text - be precise and concise

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks. Just the raw JSON object.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Provide a detailed analysis with actionable suggestions in exactly this JSON format:
{
  "analysis": "Your detailed analysis of this speaker's complete turn",
  "confidence": 0.85,
  "needsAlternatives": false,
  "needsWebSearch": [],
  "suggestions": [
    {
      "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "low|medium|high",
      "text": "Description of the issue",
      "originalText": "SHORT exact problematic text from the segment (1-5 words typically)",
      "suggestedText": "SHORT corrected text to replace it with (1-5 words typically)",
      "confidence": 0.9
    }
  ]
}

Remember: Return ONLY the JSON object above with your analysis. Nothing else.`;

const ENHANCED_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert transcript analyst. You have already performed an initial analysis of a transcript segment.
Now you have access to additional ASR (Automatic Speech Recognition) alternative transcriptions from a different model that provides additional hypothesis.

Original transcript segment:
{originalText}

Your initial analysis identified these potential issues:
{initialAnalysis}

Alternative transcriptions from different ASR model (ranked by confidence):
{asrAlternatives}

CRITICAL INSIGHTS ABOUT THE ALTERNATIVE ASR MODEL:
- This alternative ASR model provides different transcription hypotheses from the main model
- Both the main model and this alternative model now return n-best lists, so this is not the only source of alternatives
- The main value from this alternative model is getting completely different recognition hypotheses
- Focus on identifying unique words or phrases that were NOT recognized by the original model
- Look for words/hints that only appear in the alternative model's output

Based on these ASR alternatives, please (REMEMBER: respond only in {responseLanguage}):
1. FOCUS PRIMARILY on unique words or phrases that appear ONLY in the alternative ASR results
2. Investigate words/hints that the original model completely missed or misrecognized
3. Pay special attention to segments where the alternative model provides completely different word choices
4. Look for technical terms, proper nouns, or specific vocabulary that only the alternative model captured
5. Identify cases where the alternative model provides clarity for unclear or garbled segments

Create new suggestions that emphasize unique insights from the alternative model. For each suggestion:
- Set originalText to the problematic segment from the original (keep SHORT - typically 1-5 words)
- Set suggestedText to the alternative when it provides unique words/hints not in the original (keep SHORT)
- Explain why the alternative provides valuable new information (focus on unique words/phrases)
- Set higher confidence when the alternative reveals completely different word choices that make more sense

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText and suggestedText SHORT and FOCUSED (typically 1-5 words, maximum 1-2 sentences)
- Target only the specific problematic part, not entire sentences or paragraphs
- Focus on the minimal text span that needs correction
- Avoid copying large portions of text - be precise and concise

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

IMPORTANT: 
- Put MORE EMPHASIS on words/hints that are unique to the alternative model
- Investigate segments where the two models produced completely different results
- Focus on unique vocabulary, names, or technical terms only captured by the alternative
- Write every word of your analysis and suggestions in {responseLanguage}

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks, notes, or any other text. Just the raw JSON object.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Return your enhanced analysis in exactly this format:
{
  "analysis": "Your enhanced analysis incorporating ASR alternatives",
  "confidence": 0.85,
  "needsAlternatives": false,
  "needsWebSearch": [],
  "suggestions": [
    {
      "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "low|medium|high",
      "text": "Description of the issue with explanation of why ASR alternative is better",
      "originalText": "SHORT exact text from original transcript (1-5 words typically)",
      "suggestedText": "SHORT better alternative from ASR or your correction (1-5 words typically)",
      "confidence": 0.9,
      "explanation": "Optional: why the ASR alternative is more accurate"
    }
  ]
}

Remember: Return ONLY the JSON object. No other text whatsoever.`;

const MULTI_SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert transcript analyst specializing in Estonian language.

Context from full transcript summary:
{summary}

Multiple segments to analyze together (speaker turns {segmentIndexRange} of {totalSegments}):

{segmentsContent}

These are complete speaker turns - analyze each segment individually AND consider their relationship to each other.

Your task (REMEMBER: respond only in {responseLanguage}):
1. Analyze each individual segment for quality, accuracy, and coherence
2. Consider cross-segment consistency (speaker consistency, topic flow, terminology)
3. Identify potential transcription errors or unclear passages within each segment
4. Provide specific improvement suggestions for each segment

Focus on:
- Grammar and language correctness throughout each segment
- Internal coherence within each speaker's utterance  
- Cross-segment consistency and flow
- Consistency with the overall transcript context
- Proper nouns and technical terms accuracy
- Natural speech patterns
- Punctuation and formatting
- Phonetic plausibility of words (especially for potential homophones or ASR errors)

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText and suggestedText SHORT and FOCUSED (typically 1-5 words, maximum 1-2 sentences)
- Target only the specific problematic part, not entire sentences or paragraphs
- Focus on the minimal text span that needs correction
- Avoid copying large portions of text - be precise and concise

CRITICAL SEGMENT IDENTIFICATION:
- You MUST include "segmentNumber" (1-{segmentCount}) in each suggestion to identify which segment it applies to
- segmentNumber corresponds to the numbered segments above (SEGMENT 1, SEGMENT 2, etc.)
- Suggestions without valid segmentNumber will be rejected

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks. Just the raw JSON object.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Provide your analysis in exactly this JSON format:
{
  "overallAnalysis": "Your analysis considering all segments together and their relationships",
  "segmentAnalyses": [
    {
      "segmentNumber": 1,
      "analysis": "Detailed analysis of segment 1",
      "confidence": 0.85,
      "needsAlternatives": false,
      "needsWebSearch": [],
      "suggestions": [
        {
          "segmentNumber": 1,
          "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
          "severity": "low|medium|high", 
          "text": "Description of the issue",
          "originalText": "SHORT exact problematic text from segment 1 (1-5 words typically)",
          "suggestedText": "SHORT corrected text to replace it with (1-5 words typically)",
          "confidence": 0.9
        }
      ]
    }
  ]
}

Remember: Return ONLY the JSON object above with your analysis. Nothing else.`;

const MULTI_SEGMENT_ENHANCED_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert transcript analyst. You have already performed an initial analysis of multiple transcript segments.
Now you have access to additional ASR (Automatic Speech Recognition) alternative transcriptions from a different model that provides additional hypothesis for these segments.

Original transcript segments:
{originalSegments}

Your initial analysis identified these potential issues:
{initialAnalysis}

Alternative transcriptions from different ASR model (ranked by confidence):
{asrAlternatives}

CRITICAL INSIGHTS ABOUT THE ALTERNATIVE ASR MODEL:
- This alternative ASR model provides different transcription hypotheses from the main model
- Both the main model and this alternative model now return n-best lists, so this is not the only source of alternatives
- The main value from this alternative model is getting completely different recognition hypotheses
- Focus on identifying unique words or phrases that were NOT recognized by the original model
- Look for words/hints that only appear in the alternative model's output

Based on these ASR alternatives, please (REMEMBER: respond only in {responseLanguage}):
1. FOCUS PRIMARILY on unique words or phrases that appear ONLY in the alternative ASR results
2. Investigate words/hints that the original model completely missed or misrecognized
3. Pay special attention to segments where the alternative model provides completely different word choices
4. Look for technical terms, proper nouns, or specific vocabulary that only the alternative model captured
5. Identify cases where the alternative model provides clarity for unclear or garbled segments
6. Consider cross-segment consistency when the alternative model provides different alternatives

Create enhanced suggestions that emphasize unique insights from the alternative model. For each suggestion:
- Include "segmentNumber" (1-{segmentCount}) to identify which segment it applies to
- Set originalText to the problematic segment from the original (keep SHORT - typically 1-5 words)
- Set suggestedText to the alternative when it provides unique words/hints not in the original (keep SHORT)
- Explain why the alternative provides valuable new information (focus on unique words/phrases)
- Set higher confidence when the alternative reveals completely different word choices that make more sense

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText and suggestedText SHORT and FOCUSED (typically 1-5 words, maximum 1-2 sentences)
- Target only the specific problematic part, not entire sentences or paragraphs
- Focus on the minimal text span that needs correction
- Avoid copying large portions of text - be precise and concise

CRITICAL SEGMENT IDENTIFICATION:
- You MUST include "segmentNumber" (1-{segmentCount}) in each suggestion to identify which segment it applies to
- segmentNumber corresponds to the original segment numbering
- Suggestions without valid segmentNumber will be rejected

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

IMPORTANT: 
- Put MORE EMPHASIS on words/hints that are unique to the alternative model
- Investigate segments where the two models produced completely different results
- Focus on unique vocabulary, names, or technical terms only captured by the alternative
- Write every word of your analysis and suggestions in {responseLanguage}

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks, notes, or any other text. Just the raw JSON object.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Return your enhanced analysis in exactly this format:
{
  "overallAnalysis": "Your enhanced analysis incorporating ASR alternatives across all segments",
  "segmentAnalyses": [
    {
      "segmentNumber": 1,
      "analysis": "Enhanced analysis for segment 1 incorporating ASR alternatives",
      "confidence": 0.85,
      "needsAlternatives": false,
      "needsWebSearch": [],
      "suggestions": [
        {
          "segmentNumber": 1,
          "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
          "severity": "low|medium|high",
          "text": "Description of the issue with explanation of why ASR alternative is better",
          "originalText": "SHORT exact text from original transcript (1-5 words typically)",
          "suggestedText": "SHORT better alternative from ASR or your correction (1-5 words typically)",
          "confidence": 0.9,
          "explanation": "Optional: why the ASR alternative is more accurate"
        }
      ]
    }
  ]
}

Remember: Return ONLY the JSON object. No other text whatsoever.`;

export class CoordinatingAgent {
	private model;
	private asrTool: any = null;
	private phoneticTool: any = null;
	private signalQualityTool: any = null;
	private webSearchTool;
	private tiptapTool: TipTapTransactionToolDirect;
	private editor: Editor | null = null;
	private debugMode: boolean = false;
	private logger: AgentFileLogger | null = null;

	constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
		this.model = createOpenRouterChat({
			modelName,
			temperature: 0.3,
			maxTokens: 2000
		});

		// The ASR, phonetic, and signal quality tools will be loaded lazily when needed (server-side only)
		this.webSearchTool = createWebSearchTool();
		this.tiptapTool = new TipTapTransactionToolDirect();
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

	private async parseMultiSegmentResponseWithRetry(
		response: string,
		maxRetries: number = 2
	): Promise<any> {
		await this.logger?.logGeneral('debug', 'Multi-segment JSON parsing attempt', {
			responseLength: response.length,
			responsePreview: response.substring(0, 200)
		});

		// First attempt: Use robust parsing utility
		const parseResult = robustJsonParse(response);

		if (parseResult.success) {
			await this.logger?.logGeneral('debug', 'Multi-segment JSON parsed successfully on first attempt', {
				fixesApplied: parseResult.fixesApplied
			});

			// Validate multi-segment structure
			if (this.validateMultiSegmentStructure(parseResult.data)) {
				return parseResult.data;
			} else {
				await this.logger?.logGeneral('warn', 'Multi-segment JSON structure validation failed', {
					keys: Object.keys(parseResult.data)
				});
			}
		} else {
			await this.logger?.logGeneral('warn', 'Initial multi-segment JSON parsing failed', {
				error: parseResult.error,
				extractedJsonPreview: parseResult.extractedJson?.substring(0, 200)
			});
		}

		// Retry with LLM self-correction
		for (let retry = 1; retry <= maxRetries; retry++) {
			await this.logger?.logGeneral(
				'debug',
				`Multi-segment retry ${retry}/${maxRetries}: Requesting JSON correction from LLM`
			);

			const correctionPrompt = `${formatParsingErrorForLLM(
				parseResult.error || 'Invalid JSON structure',
				response
			)}

Please provide ONLY valid JSON that matches this exact multi-segment structure:
{
  "overallAnalysis": "string - your analysis text",
  "segmentAnalyses": [
    {
      "segmentNumber": 1,
      "analysis": "string - segment analysis",
      "confidence": 0.0 to 1.0,
      "needsAlternatives": true or false,
      "needsWebSearch": ["array", "of", "search", "terms"] or [],
      "suggestions": [
        {
          "segmentNumber": 1,
          "type": "one of: grammar|punctuation|clarity|consistency|speaker|boundary",
          "severity": "one of: low|medium|high",
          "text": "description of the issue",
          "originalText": "exact text to replace",
          "suggestedText": "replacement text",
          "confidence": 0.0 to 1.0
        }
      ]
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No explanations, no text before or after, no markdown code blocks.`;

			await this.logger?.logGeneral('debug', 'Sending multi-segment correction prompt to LLM');

			try {
				const correctedResponse = await this.model.invoke([
					new HumanMessage({ content: correctionPrompt })
				]);

				const correctedContent = correctedResponse.content as string;
				await this.logger?.logGeneral('debug', 'Multi-segment LLM correction response received', {
					responseLength: correctedContent.length
				});

				const retryResult = robustJsonParse(correctedContent);

				if (retryResult.success && this.validateMultiSegmentStructure(retryResult.data)) {
					await this.logger?.logGeneral('debug', `Multi-segment JSON parsed successfully on retry ${retry}`, {
						fixesApplied: retryResult.fixesApplied
					});
					return retryResult.data;
				} else {
					await this.logger?.logGeneral('warn', `Multi-segment retry ${retry} failed`, {
						error: retryResult.error
					});
				}
			} catch (error) {
				await this.logger?.logGeneral('error', `Multi-segment retry ${retry} error`, { error });
			}
		}

		// Fallback after all retries failed
		await this.logger?.logGeneral(
			'error',
			'All multi-segment JSON parsing attempts failed, using fallback structure'
		);

		return {
			overallAnalysis: response.substring(0, 1000),
			segmentAnalyses: []
		};
	}

	private validateMultiSegmentStructure(data: any): boolean {
		if (!data || typeof data !== 'object') return false;
		if (!data.overallAnalysis || typeof data.overallAnalysis !== 'string') return false;
		if (!Array.isArray(data.segmentAnalyses)) return false;
		
		// Validate each segment analysis
		for (const segmentAnalysis of data.segmentAnalyses) {
			if (!segmentAnalysis.segmentNumber || typeof segmentAnalysis.segmentNumber !== 'number') return false;
			if (!segmentAnalysis.analysis || typeof segmentAnalysis.analysis !== 'string') return false;
			if (segmentAnalysis.suggestions && Array.isArray(segmentAnalysis.suggestions)) {
				// Validate each suggestion has segmentNumber
				for (const suggestion of segmentAnalysis.suggestions) {
					if (!suggestion.segmentNumber || typeof suggestion.segmentNumber !== 'number') return false;
				}
			}
		}
		
		return true;
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

			const correctionPrompt = `${formatParsingErrorForLLM(
				parseResult.error || 'Invalid JSON structure',
				response
			)}

Please provide ONLY valid JSON that matches this exact structure:
{
  "analysis": "string - your analysis text",
  "confidence": 0.0 to 1.0,
  "needsAlternatives": true or false,
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
				const correctedResponse = await this.model.invoke([
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

			// Build the analysis prompt
			const prompt = SEGMENT_ANALYSIS_PROMPT.replace('{summary}', summary.summary)
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
			await this.logger?.logLLMRequest(prompt, 'Claude-3.5-Sonnet', segment.index);

			const response = await this.model.invoke([new HumanMessage({ content: prompt })]);

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
			const expectedKeys = [
				'analysis',
				'confidence',
				'needsAlternatives',
				'needsWebSearch',
				'suggestions'
			];
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
			const shouldUseASR =
				analysisData.needsAlternatives || (signalQuality && signalQuality.snr_db < 15); // Aggressive ASR for poor audio

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

					// Create enhanced analysis prompt
					const enhancedPrompt = ENHANCED_ANALYSIS_PROMPT.replace('{originalText}', segment.text)
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
						'Claude-3.5-Sonnet (Enhanced Analysis)',
						segment.index
					);

					const enhancedResponse = await this.model.invoke([
						new HumanMessage({ content: enhancedPrompt })
					]);

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
					const enhancedData = await this.parseResponseWithRetry(
						enhancedResponse.content as string,
						['analysis', 'confidence', 'needsAlternatives', 'needsWebSearch', 'suggestions']
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
										text: suggestion.originalText,
										candidate: suggestion.suggestedText
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
					speakerName: segment.speakerName || segment.speakerTag,
					analysis: analysisData.analysis,
					suggestions:
						processedSuggestions.length > 0 ? processedSuggestions : analysisData.suggestions,
					nBestResults,
					status: 'analyzed'
				},
				update: {
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

	async analyzeMultipleSegments(request: MultiSegmentAnalysisRequest): Promise<MultiSegmentAnalysisResult> {
		try {
			const { segments, summary, fileId, uiLanguage, transcriptFilePath } = request;

			// Validate input - max 5 segments
			if (segments.length === 0) {
				throw new Error('No segments provided for analysis');
			}
			if (segments.length > 5) {
				throw new Error(`Too many segments: ${segments.length}. Maximum 5 segments allowed.`);
			}

			// Initialize logger if transcript path is provided
			if (transcriptFilePath) {
				this.initializeLogger(transcriptFilePath, fileId);
				await this.logger?.logGeneral(
					'info',
					`Starting multi-segment analysis for ${segments.length} segments`,
					{
						segmentIndices: segments.map(s => s.index),
						segmentRange: `${segments[0].index}-${segments[segments.length - 1].index}`
					}
				);
			}

			// Normalize UI language and get language name
			const normalizedLanguage = normalizeLanguageCode(uiLanguage);
			const responseLanguage = getLanguageName(normalizedLanguage);

			// Debug logging for language detection
			await this.logger?.logGeneral('debug', 'Multi-segment language detection', {
				originalUiLanguage: uiLanguage,
				normalizedLanguage,
				responseLanguage,
				segmentCount: segments.length
			});

			// Build segments content for prompt
			const segmentsContent = segments.map((segment, idx) => {
				const segmentNumber = idx + 1;
				let alternativesSection = '';
				if (segment.alternatives && segment.alternatives.length > 0) {
					const alternativesText = segment.alternatives
						.map((alt, altIdx) => `  ${altIdx + 1}. ${alt.text} (confidence: ${alt.avg_logprob.toFixed(3)})`)
						.join('\n');
					alternativesSection = `\n  Alternatives:\n${alternativesText}`;
				}

				return `SEGMENT ${segmentNumber} (Index: ${segment.index}):
Speaker: ${segment.speakerName || segment.speakerTag}
Text: ${segment.text}
Duration: ${(segment.endTime - segment.startTime).toFixed(2)} seconds
Word count: ${segment.words.length} words${alternativesSection}`;
			}).join('\n\n');

			// Create segment index range for display
			const segmentIndexRange = segments.length > 1 
				? `${segments[0].index + 1}-${segments[segments.length - 1].index + 1}`
				: `${segments[0].index + 1}`;

			// Build the multi-segment analysis prompt
			const prompt = MULTI_SEGMENT_ANALYSIS_PROMPT
				.replace('{summary}', summary.summary)
				.replace('{segmentIndexRange}', segmentIndexRange)
				.replace('{totalSegments}', 'TBD')
				.replace('{segmentsContent}', segmentsContent)
				.replace('{segmentCount}', segments.length.toString())
				.replace('{responseLanguage}', responseLanguage);

			await this.logger?.logGeneral(
				'info',
				'Starting multi-segment LLM analysis request',
				{
					segmentCount: segments.length,
					totalTextLength: segments.reduce((sum, s) => sum + s.text.length, 0),
					speakers: [...new Set(segments.map(s => s.speakerName || s.speakerTag))]
				}
			);

			// Get initial multi-segment analysis
			const llmStartTime = Date.now();
			await this.logger?.logLLMRequest(prompt, 'Claude-3.5-Sonnet (Multi-Segment)', 0);

			const response = await this.model.invoke([new HumanMessage({ content: prompt })]);

			const llmDuration = Date.now() - llmStartTime;
			await this.logger?.logLLMResponse(response.content as string, llmDuration, 0);

			// Parse the multi-segment response
			const analysisData = await this.parseMultiSegmentResponseWithRetry(response.content as string);

			await this.logger?.logGeneral(
				'debug',
				'Multi-segment analysis data extracted successfully',
				{
					overallAnalysisLength: analysisData.overallAnalysis?.length || 0,
					segmentAnalysesCount: analysisData.segmentAnalyses?.length || 0
				}
			);

			// Process each segment's analysis and convert to individual results
			const results: SegmentAnalysisResult[] = [];

			for (let i = 0; i < segments.length; i++) {
				const segment = segments[i];
				const segmentNumber = i + 1;
				
				// Find matching segment analysis from LLM response
				const segmentAnalysis = analysisData.segmentAnalyses?.find(
					(sa: any) => sa.segmentNumber === segmentNumber
				);

				if (!segmentAnalysis) {
					await this.logger?.logGeneral('warn', `No analysis found for segment ${segmentNumber}`, {
						segmentIndex: segment.index
					});
					
					// Create fallback result
					results.push({
						segmentIndex: segment.index,
						analysis: `Fallback analysis for segment ${segment.index}`,
						suggestions: [],
						confidence: 0.5,
						signalQuality: null,
						analysisStrategy: 'fallback',
						dynamicConfidenceThreshold: 0.7
					});
					continue;
				}

				// Process suggestions for this segment
				const processedSuggestions = [];
				if (segmentAnalysis.suggestions && Array.isArray(segmentAnalysis.suggestions)) {
					for (const suggestion of segmentAnalysis.suggestions) {
						// Validate segment number matches
						if (suggestion.segmentNumber !== segmentNumber) {
							await this.logger?.logGeneral('warn', 'Suggestion segment number mismatch', {
								expected: segmentNumber,
								actual: suggestion.segmentNumber,
								segmentIndex: segment.index
							});
							continue;
						}

						// Compute positions within segment text
						let from: number | undefined;
						let to: number | undefined;

						if (suggestion.originalText && segment.text) {
							const index = segment.text.indexOf(suggestion.originalText);
							if (index !== -1) {
								from = index;
								to = index + suggestion.originalText.length;
							}
						}

						// Create processed suggestion
						processedSuggestions.push({
							...suggestion,
							from,
							to,
							segmentIndex: segment.index, // Use actual segment index, not segment number
							shouldAutoApply: suggestion.confidence >= 0.7,
							applied: false,
							requiresManualReview: suggestion.confidence < 0.7
						});
					}
				}

				// Create result for this segment
				results.push({
					segmentIndex: segment.index,
					analysis: segmentAnalysis.analysis || `Analysis for segment ${segment.index}`,
					suggestions: processedSuggestions,
					nBestResults: null, // Will be filled by ASR if needed
					confidence: segmentAnalysis.confidence || 0.7,
					signalQuality: null, // Will be filled by signal quality tool if needed
					analysisStrategy: 'multi_segment',
					dynamicConfidenceThreshold: 0.7
				});

				await this.logger?.logGeneral('info', `Processed segment ${segmentNumber}`, {
					segmentIndex: segment.index,
					suggestionsCount: processedSuggestions.length,
					confidence: segmentAnalysis.confidence
				});
			}

			// Save all results to database in batch
			for (const result of results) {
				const segment = segments.find(s => s.index === result.segmentIndex);
				if (segment) {
					await prisma.analysisSegment.upsert({
						where: {
							fileId_segmentIndex: {
								fileId,
								segmentIndex: result.segmentIndex
							}
						},
						create: {
							fileId,
							segmentIndex: result.segmentIndex,
							startTime: segment.startTime,
							endTime: segment.endTime,
							startWord: segment.startWord,
							endWord: segment.endWord,
							originalText: segment.text,
							speakerName: segment.speakerName || segment.speakerTag,
							analysis: result.analysis,
							suggestions: result.suggestions,
							nBestResults: result.nBestResults,
							status: 'analyzed'
						},
						update: {
							speakerName: segment.speakerName || segment.speakerTag,
							analysis: result.analysis,
							suggestions: result.suggestions,
							nBestResults: result.nBestResults,
							status: 'analyzed'
						}
					});
				}
			}

			await this.logger?.logGeneral('info', 'Multi-segment analysis completed successfully', {
				segmentCount: segments.length,
				totalSuggestions: results.reduce((sum, r) => sum + r.suggestions.length, 0),
				overallAnalysisLength: analysisData.overallAnalysis?.length || 0
			});

			return {
				results,
				overallAnalysis: analysisData.overallAnalysis || 'Multi-segment analysis completed'
			};

		} catch (error) {
			await this.logger?.logGeneral('error', 'Multi-segment analysis failed', { error });
			throw new Error(
				`Failed to analyze multiple segments: ${error instanceof Error ? error.message : 'Unknown error'}`
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

export function getCoordinatingAgent(modelName?: string): CoordinatingAgent {
	if (!coordinatingAgentInstance || modelName) {
		coordinatingAgentInstance = new CoordinatingAgent(modelName);
	}
	return coordinatingAgentInstance;
}
