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
import { logEditorSnapshot, createEditorSnapshot, searchInSnapshot } from '$lib/services/editorDebugger';
import { runAutomatedTestSuite } from '$lib/services/textReplacementTestHarness';
import { robustJsonParse, formatParsingErrorForLLM, validateJsonStructure } from './utils/jsonParser';

export interface SegmentAnalysisRequest {
	fileId: string;
	segment: SegmentWithTiming;
	summary: TranscriptSummary;
	audioFilePath: string;
	uiLanguage?: string;
}

export interface SegmentAnalysisResult {
	segmentIndex: number;
	analysis: string;
	suggestions: any[];
	nBestResults?: any;
	confidence: number;
}

const SEGMENT_ANALYSIS_PROMPT = `You are an expert transcript analyst specializing in Estonian and Finnish languages.

Context from full transcript summary:
{summary}

Current speaker segment to analyze (speaker turn {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds
Word count: {wordCount} words

This is a complete speaker turn - analyze the entire utterance from {speaker}.

Your task:
1. Analyze this complete speaker turn for quality, accuracy, and coherence
2. Consider the context from the full transcript summary
3. Identify potential transcription errors or unclear passages within this speaker's utterance
4. Check if the speaker boundaries are appropriate (does it seem like one coherent turn?)
5. Note if you would need alternative transcriptions or additional context
6. Provide specific improvement suggestions for this speaker's turn. Do not suggest speaker labeling changes

Focus on:
- Grammar and language correctness throughout the speaker's turn
- Internal coherence within this speaker's utterance
- Consistency with the overall transcript context
- Proper nouns and technical terms accuracy
- Speaker attribution accuracy (is this all from the same speaker?)
- Natural speech patterns and turn-taking
- Punctuation and formatting

IMPORTANT: Provide your analysis and all suggestions in {responseLanguage} language.

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks. Just the raw JSON object.

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
      "originalText": "exact problematic text from the segment",
      "suggestedText": "corrected text to replace it with",
      "confidence": 0.9
    }
  ]
}

Remember: Return ONLY the JSON object above with your analysis. Nothing else.`;

const ENHANCED_ANALYSIS_PROMPT = `You are an expert transcript analyst. You have already performed an initial analysis of a transcript segment.
Now you have access to additional ASR (Automatic Speech Recognition) alternative transcriptions from a specialized model that excels at recognizing English and mixed-language content.

Original transcript segment:
{originalText}

Your initial analysis identified these potential issues:
{initialAnalysis}

Alternative transcriptions from ASR (ranked by confidence):
{asrAlternatives}

CRITICAL INSIGHTS ABOUT THE ASR MODEL:
- This specialized ASR model is particularly good at recognizing also English words and phrases
- It handles code-switching (mixing languages) better than the primary model
- It can be more accurate with technical terms, brand names, and proper nouns
- The primary model that produced the original transcript has no English capability

Based on these ASR alternatives, please:
1. ACTIVELY LOOK for places where the ASR alternatives contain English words that make more sense
   Example: If original has "haud Hazdić vahe" and ASR has "how does it work", the ASR is likely correct
2. Check for misrecognized English phrases that appear as nonsensical Estonian/Finnish
3. Identify technical terms or proper nouns that ASR recognized better
4. Replace any garbled or unclear segments with clearer ASR alternatives
5. When ASR shows English text with high confidence, strongly consider using it

Create new suggestions that incorporate the best ASR alternatives. For each suggestion:
- Set originalText to the problematic segment from the original
- Set suggestedText to the better alternative from ASR (if applicable)
- Explain why the ASR alternative is better (e.g., "ASR correctly identified English phrase")
- Set high confidence (0.8+) when ASR clearly shows English or technical terms

IMPORTANT: 
- The ASR alternatives often reveal English content that was misrecognized as Estonian/Finnish
- Provide your updated analysis and suggestions in {responseLanguage} language
- Be aggressive in suggesting ASR alternatives when they contain sensible English text

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks, notes, or any other text. Just the raw JSON object.

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
      "originalText": "exact text from original transcript",
      "suggestedText": "better alternative from ASR or your correction",
      "confidence": 0.9,
      "explanation": "Optional: why the ASR alternative is more accurate"
    }
  ]
}

Remember: Return ONLY the JSON object. No other text whatsoever.`;

export class CoordinatingAgentSimple {
	private model;
	private asrTool: any = null;
	private webSearchTool;
	private tiptapTool: TipTapTransactionToolDirect;
	private editor: Editor | null = null;
	private debugMode: boolean = false;

	constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
		this.model = createOpenRouterChat({
			modelName,
			temperature: 0.3,
			maxTokens: 2000
		});

		// The ASR tool will be loaded lazily when needed (server-side only)
		this.webSearchTool = createWebSearchTool();
		this.tiptapTool = new TipTapTransactionToolDirect();
	}

	private async initializeASRTool() {
		if (this.asrTool) return;
		
		// Only load on server side
		if (typeof window === 'undefined') {
			try {
				const { createASRNBestServerNodeTool } = await import('./tools/asrNBestServerNode');
				this.asrTool = createASRNBestServerNodeTool('https://tekstiks.ee/asr/transcribe/alternatives');
			} catch (e) {
				console.error('Failed to load ASR tool:', e);
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

	async runTests() {
		if (!this.editor) {
			throw new Error('Editor not set');
		}
		await runAutomatedTestSuite(this.editor);
	}

	debugSearchText(searchText: string) {
		if (!this.editor) {
			console.error('Editor not set');
			return;
		}
		
		const snapshot = createEditorSnapshot(this.editor);
		const results = searchInSnapshot(snapshot, searchText);
		
		console.group(`🔍 Debug Search: "${searchText}"`);
		console.log('Results:', results);
		
		if (results.exactMatch) {
			console.log('✅ Exact match found at positions:', results.locations.map(l => l.position));
		} else if (results.found) {
			console.log('⚠️ All words found but not as exact phrase');
			console.log('Found words:', results.wordAnalysis.foundWords);
			console.log('Word positions:', Array.from(results.wordAnalysis.wordPositions.entries()));
		} else {
			console.log('❌ Not found');
			console.log('Missing words:', results.wordAnalysis.missingWords);
		}
		
		console.groupEnd();
		return results;
	}

	private cleanJsonString(str: string): string {
		// Remove control characters except for valid JSON whitespace
		return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
			// Also remove any non-breaking spaces that might cause issues
			.replace(/\u00A0/g, ' ')
			// Normalize quotes
			.replace(/[\u2018\u2019]/g, "'")
			.replace(/[\u201C\u201D]/g, '"');
	}

	private async parseResponseWithRetry(
		response: string,
		expectedStructure: string[],
		maxRetries: number = 2
	): Promise<any> {
		console.group('🔍 JSON Parsing Attempt');
		console.log('Response length:', response.length);
		console.log('First 200 chars:', response.substring(0, 200));
		
		// First attempt: Use robust parsing utility
		const parseResult = robustJsonParse(response);
		
		if (parseResult.success) {
			console.log('✅ JSON parsed successfully on first attempt');
			if (parseResult.fixesApplied && parseResult.fixesApplied.length > 0) {
				console.log('Fixes applied:', parseResult.fixesApplied);
			}
			
			// Validate structure
			if (validateJsonStructure(parseResult.data, expectedStructure)) {
				console.groupEnd();
				return parseResult.data;
			} else {
				console.warn('⚠️ JSON structure validation failed, missing keys:', 
					expectedStructure.filter(key => !(key in parseResult.data)));
			}
		} else {
			console.warn('⚠️ Initial JSON parsing failed:', parseResult.error);
			if (parseResult.extractedJson) {
				console.log('Extracted JSON attempt:', parseResult.extractedJson.substring(0, 200));
			}
		}
		
		// Retry with LLM self-correction
		for (let retry = 1; retry <= maxRetries; retry++) {
			console.group(`🔄 Retry ${retry}/${maxRetries}: Requesting JSON correction from LLM`);
			
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
			
			console.log('Sending correction prompt to LLM');
			
			try {
				const correctedResponse = await this.model.invoke([
					new HumanMessage({ content: correctionPrompt })
				]);
				
				const correctedContent = correctedResponse.content as string;
				console.log('LLM correction response length:', correctedContent.length);
				
				const retryResult = robustJsonParse(correctedContent);
				
				if (retryResult.success) {
					console.log(`✅ JSON parsed successfully on retry ${retry}`);
					if (retryResult.fixesApplied && retryResult.fixesApplied.length > 0) {
						console.log('Fixes applied:', retryResult.fixesApplied);
					}
					console.groupEnd(); // End retry group
					console.groupEnd(); // End main parsing group
					return retryResult.data;
				} else {
					console.warn(`⚠️ Retry ${retry} failed:`, retryResult.error);
				}
			} catch (error) {
				console.error(`❌ Retry ${retry} error:`, error);
			}
			
			console.groupEnd(); // End retry group
		}
		
		// Fallback after all retries failed
		console.error('❌ All JSON parsing attempts failed, using fallback structure');
		console.groupEnd(); // End main parsing group
		
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
			const { segment, summary, audioFilePath, fileId, uiLanguage } = request;

			// Normalize UI language and get language name
			const normalizedLanguage = normalizeLanguageCode(uiLanguage);
			const responseLanguage = getLanguageName(normalizedLanguage);

			// Build the analysis prompt
			const prompt = SEGMENT_ANALYSIS_PROMPT.replace('{summary}', summary.summary)
				.replace('{segmentIndex}', (segment.index + 1).toString())
				.replace('{totalSegments}', 'TBD')
				.replace(/\{speaker\}/g, segment.speakerName || segment.speakerTag) // Replace all occurrences
				.replace('{text}', segment.text)
				.replace('{duration}', (segment.endTime - segment.startTime).toFixed(2))
				.replace('{wordCount}', segment.words.length.toString())
				.replace('{responseLanguage}', responseLanguage);

			// Log the analysis request
			console.group('🤖 LLM Analysis Request');
			console.log('Segment:', segment.speakerName || segment.speakerTag);
			console.log('Text length:', segment.text.length);
			console.log('Duration:', (segment.endTime - segment.startTime).toFixed(2), 'seconds');
			console.groupEnd();

			// Get initial analysis
			const response = await this.model.invoke([new HumanMessage({ content: prompt })]);
			
			console.group('📝 LLM Response Processing');
			console.log('Raw response received, length:', (response.content as string).length);
			
			// Parse the response with robust error recovery and retry
			const expectedKeys = ['analysis', 'confidence', 'needsAlternatives', 'needsWebSearch', 'suggestions'];
			const analysisData = await this.parseResponseWithRetry(
				response.content as string,
				expectedKeys
			);
			
			console.log('Analysis data extracted successfully');
			console.log('Suggestions count:', analysisData.suggestions?.length || 0);
			console.groupEnd();

			let nBestResults = null;

			// TEMPORARY: Always use ASR N-best tool for testing
			// if (analysisData.needsAlternatives) {
			try {
				// Initialize ASR tool if not already done
				await this.initializeASRTool();
				
				if (this.asrTool) {
					console.log('Calling ASR N-best tool for segment:', {
						audioFilePath,
						startTime: segment.startTime,
						endTime: segment.endTime
					});
					const asrResult = await this.asrTool._call({
						audioFilePath,
						startTime: segment.startTime,
						endTime: segment.endTime,
						nBest: 5
					});
					nBestResults = JSON.parse(asrResult);
					console.log('ASR N-best results received:', nBestResults);
				} else {
					console.log('ASR tool not available (client-side context)');
				}
			} catch (e) {
				console.error('ASR N-best tool error:', e);
			}
			// }

			// If we have ASR results, perform enhanced analysis
			if (nBestResults && nBestResults.alternatives && nBestResults.alternatives.length > 0) {
				try {
					console.log(
						'Performing enhanced analysis with ASR results for segment:',
						segment.speakerName
					);
					console.log('Original text:', segment.text);
					console.log('ASR alternatives:', nBestResults.alternatives);

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

					console.group('🔬 Enhanced Analysis with ASR Results');
					console.log('Sending enhanced prompt to LLM');
					
					// Get enhanced analysis
					const enhancedResponse = await this.model.invoke([
						new HumanMessage({ content: enhancedPrompt })
					]);

					console.log('Enhanced response received, length:', (enhancedResponse.content as string).length);
					
					// Parse enhanced response with retry mechanism
					const enhancedData = await this.parseResponseWithRetry(
						enhancedResponse.content as string,
						['analysis', 'confidence', 'needsAlternatives', 'needsWebSearch', 'suggestions']
					);
					
					if (enhancedData.suggestions && enhancedData.suggestions.length > 0) {
						console.log('✅ Enhanced analysis produced', enhancedData.suggestions.length, 'suggestions');
						// Update analysis data with enhanced suggestions
						analysisData.suggestions = enhancedData.suggestions;
						analysisData.analysis = enhancedData.analysis || analysisData.analysis;
						analysisData.confidence = enhancedData.confidence || analysisData.confidence;
					} else {
						console.log('⚠️ Enhanced analysis produced no suggestions');
					}
					
					console.groupEnd();
				} catch (e) {
					console.error('Enhanced analysis error:', e);
				}
			} else {
				console.log('No ASR results available for enhanced analysis');
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
						console.log(`Web search for "${term}":`, searchResult);
					} catch (e) {
						console.error(`Web search error for "${term}":`, e);
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
							console.log(`📍 Found position for "${searchText}": [${from}, ${to}] in segment`);
						} else {
							console.log(`⚠️ Could not find position for "${searchText}" in segment`);
						}
					}
					
					// Mark high-confidence suggestions for automatic application
					// These will be applied as diff nodes on the client-side
					if (suggestion.confidence >= 0.5 && suggestion.originalText && suggestion.suggestedText) {
						processedSuggestions.push({
							...suggestion,
							from,  // Character position in segment
							to,    // Character position in segment
							segmentIndex: segment.index,  // Which segment this belongs to
							shouldAutoApply: true,
							applied: false,
							requiresManualReview: false
						});
						console.log(`✅ Marked for auto-apply: "${suggestion.originalText}" → "${suggestion.suggestedText}"`);
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
						console.log(`⚠️ Marked for manual review: "${suggestion.originalText}" → "${suggestion.suggestedText}"`);
					}
				}
				
				console.log(`📊 Processed ${processedSuggestions.length} suggestions:`);
				console.log(`  - ${processedSuggestions.filter(s => s.shouldAutoApply).length} marked for auto-apply`);
				console.log(`  - ${processedSuggestions.filter(s => s.requiresManualReview).length} require manual review`);
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

			return {
				segmentIndex: segment.index,
				analysis: analysisData.analysis,
				suggestions: processedSuggestions.length > 0 ? processedSuggestions : analysisData.suggestions,
				nBestResults,
				confidence: analysisData.confidence
			};
		} catch (error) {
			console.error('Segment analysis error:', error);
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

			const transactionResult = JSON.parse(result);
			return transactionResult;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Singleton instance
let coordinatingAgentInstance: CoordinatingAgentSimple | null = null;

export function getCoordinatingAgent(modelName?: string): CoordinatingAgentSimple {
	if (!coordinatingAgentInstance || modelName) {
		coordinatingAgentInstance = new CoordinatingAgentSimple(modelName);
	}
	return coordinatingAgentInstance;
}
