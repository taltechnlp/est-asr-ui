import { createOpenRouterChat, OPENROUTER_MODELS } from '$lib/llm/openrouter-direct';
import { HumanMessage } from '@langchain/core/messages';
import { createWebSearchTool } from './tools';
import { createASRNBestServerNodeTool } from './tools/asrNBestServerNode';
import { TipTapTransactionToolDirect } from './tools/tiptapTransaction';
import type { TranscriptSummary, AnalysisSegment } from '@prisma/client';
import { prisma } from '$lib/db/client';
import type { SegmentWithTiming } from '$lib/utils/extractWordsFromEditor';
import type { Editor } from '@tiptap/core';
import { getLanguageName, normalizeLanguageCode } from '$lib/utils/language';
import { logEditorSnapshot, createEditorSnapshot, searchInSnapshot } from '$lib/services/editorDebugger';
import { runAutomatedTestSuite } from '$lib/services/textReplacementTestHarness';

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

Provide a detailed analysis with actionable suggestions in the following JSON format:
{
  "analysis": "Your detailed analysis of this speaker's complete turn",
  "confidence": 0.85, // Your confidence in the transcription accuracy (0-1)
  "needsAlternatives": false, // Whether ASR alternatives would be helpful
  "needsWebSearch": [], // List of terms that need web search verification
  "suggestions": [
    {
      "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "low|medium|high",
      "text": "Description of the issue",
      "originalText": "problematic text",
      "suggestedText": "corrected text",
      "confidence": 0.9
    }
  ]
}`;

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
- Provide your analysis and all suggestions in {responseLanguage} language.

Provide your enhanced analysis in the same JSON format as before.`;

export class CoordinatingAgentSimple {
	private model;
	private asrTool;
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

		// The ASR service endpoint for alternatives is /transcribe/alternatives
		this.asrTool = createASRNBestServerNodeTool('https://tekstiks.ee/asr/transcribe/alternatives');
		this.webSearchTool = createWebSearchTool();
		this.tiptapTool = new TipTapTransactionToolDirect();
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

			// Get initial analysis
			const response = await this.model.invoke([new HumanMessage({ content: prompt })]);

			// Parse the response
			let analysisData;
			try {
				const content = response.content as string;
				const jsonMatch = content.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					throw new Error('No JSON found in response');
				}
				// Clean the JSON string before parsing
				const cleanedJson = this.cleanJsonString(jsonMatch[0]);
				analysisData = JSON.parse(cleanedJson);
			} catch (e) {
				console.error('Failed to parse analysis response:', e);
				analysisData = {
					analysis: response.content,
					confidence: 0.7,
					needsAlternatives: false,
					needsWebSearch: [],
					suggestions: []
				};
			}

			let nBestResults = null;

			// TEMPORARY: Always use ASR N-best tool for testing
			// if (analysisData.needsAlternatives) {
			try {
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

					// Get enhanced analysis
					const enhancedResponse = await this.model.invoke([
						new HumanMessage({ content: enhancedPrompt })
					]);

					// Parse enhanced response
					try {
						const enhancedContent = enhancedResponse.content as string;
						const enhancedJsonMatch = enhancedContent.match(/\{[\s\S]*\}/);
						if (enhancedJsonMatch) {
							// Clean the JSON string before parsing
							const cleanedJson = this.cleanJsonString(enhancedJsonMatch[0]);
							const enhancedData = JSON.parse(cleanedJson);
							console.log('Enhanced analysis suggestions:', enhancedData.suggestions);
							// Update analysis data with enhanced suggestions
							if (enhancedData.suggestions) {
								analysisData.suggestions = enhancedData.suggestions;
								analysisData.analysis = enhancedData.analysis || analysisData.analysis;
							}
						}
					} catch (e) {
						console.error('Failed to parse enhanced analysis:', e);
						console.error('Enhanced response content:', enhancedResponse.content);
					}
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

			// Apply high-confidence suggestions automatically
			const appliedSuggestions = [];
			if (analysisData.suggestions && Array.isArray(analysisData.suggestions)) {
				// Log editor state before applying suggestions if in debug mode
				if (this.debugMode && this.editor) {
					logEditorSnapshot(this.editor, 'Before applying suggestions');
				}
				
				for (const suggestion of analysisData.suggestions) {
					if (suggestion.confidence >= 0.5 && suggestion.originalText && suggestion.suggestedText) {
						try {
							// Debug search before applying
							if (this.debugMode) {
								console.log(`\n📝 Attempting to apply suggestion:`);
								console.log(`  Original: "${suggestion.originalText}"`);
								console.log(`  Suggested: "${suggestion.suggestedText}"`);
								this.debugSearchText(suggestion.originalText);
							}
							
							const result = await this.tiptapTool.applyTransaction({
								originalText: suggestion.originalText,
								suggestedText: suggestion.suggestedText,
								segmentId: segment.speakerName || segment.speakerTag,
								changeType: suggestion.type || 'text_replacement',
								confidence: suggestion.confidence,
								context: suggestion.text || suggestion.explanation || ''
							});

							const transactionResult = JSON.parse(result);
							if (transactionResult.success) {
								appliedSuggestions.push({
									...suggestion,
									applied: true,
									appliedAt: transactionResult.appliedAt,
									transactionId: transactionResult.transactionId
								});
							} else {
								console.warn('Failed to apply suggestion:', transactionResult.error);
								appliedSuggestions.push({
									...suggestion,
									applied: false,
									error: transactionResult.error
								});
							}
						} catch (error) {
							console.error('Error applying suggestion:', error);
							appliedSuggestions.push({
								...suggestion,
								applied: false,
								error: error instanceof Error ? error.message : 'Unknown error'
							});
						}
					} else {
						// Low confidence suggestions remain unapplied for manual review
						appliedSuggestions.push({
							...suggestion,
							applied: false,
							requiresManualReview: true
						});
					}
				}
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
						appliedSuggestions.length > 0 ? appliedSuggestions : analysisData.suggestions,
					nBestResults,
					status: 'analyzed'
				},
				update: {
					speakerName: segment.speakerName || segment.speakerTag,
					analysis: analysisData.analysis,
					suggestions:
						appliedSuggestions.length > 0 ? appliedSuggestions : analysisData.suggestions,
					nBestResults,
					status: 'analyzed'
				}
			});

			return {
				segmentIndex: segment.index,
				analysis: analysisData.analysis,
				suggestions: appliedSuggestions.length > 0 ? appliedSuggestions : analysisData.suggestions,
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
