import { createOpenRouterChat, OPENROUTER_MODELS } from '$lib/llm/openrouter-direct';
import { HumanMessage } from '@langchain/core/messages';
import { createWebSearchTool } from './tools';
import { PositionAwareTipTapToolDirect } from './tools/positionAwareTiptapTool';
import type { TranscriptSummary, AnalysisSegment } from '@prisma/client';
import { prisma } from '$lib/db/client';
import type { Editor } from '@tiptap/core';
import { getLanguageName, normalizeLanguageCode } from '$lib/utils/language';
import {
  extractSpeakerSegmentsWithPositions,
  formatSegmentsForLLM,
  type PositionAwareSegment
} from '$lib/services/positionAwareExtractor';
import { getReconciliationService } from '$lib/services/editReconciliation';
import { getPositionMapper } from '$lib/services/positionMapper';

export interface PositionAwareAnalysisRequest {
  fileId: string;
  segments: PositionAwareSegment[];
  summary: TranscriptSummary;
  audioFilePath: string;
  uiLanguage?: string;
}

export interface PositionAwareAnalysisResult {
  segmentIds: string[];
  analysis: string;
  suggestions: any[];
  nBestResults?: any;
  confidence: number;
  positionsUsed: boolean;
}

const POSITION_AWARE_ANALYSIS_PROMPT = `You are an expert transcript analyst specializing in Estonian and Finnish languages.

CRITICAL: You will receive transcript segments with POSITION INFORMATION. Each segment has:
- id: Unique identifier for the segment
- text: The actual text content
- offset: The absolute position in the document
- length: The length of the text

When suggesting changes, you MUST provide:
1. segmentId: The ID of the segment containing the text
2. startChar: Character offset from the START of that segment (0-based)
3. endChar: Character offset from the START of that segment
4. originalText: The exact text you're replacing (for verification)
5. suggestedText: Your suggested replacement

Context from full transcript summary:
{summary}

Segments to analyze:
{segments}

Your task:
1. Analyze these segments for quality, accuracy, and coherence
2. Identify potential transcription errors or unclear passages
3. Provide specific improvement suggestions using EXACT POSITIONS

IMPORTANT: 
- Use character positions RELATIVE TO EACH SEGMENT'S START
- The first character of each segment is at position 0
- Count characters including spaces and punctuation
- Your positions will be converted to absolute document positions automatically

Provide your analysis and suggestions in {responseLanguage} language.

Return your response in this JSON format:
{
  "analysis": "Your detailed analysis",
  "confidence": 0.85,
  "suggestions": [
    {
      "segmentId": "speaker_0",
      "startChar": 10,
      "endChar": 25,
      "originalText": "exact text being replaced",
      "suggestedText": "corrected text",
      "type": "grammar|punctuation|clarity|consistency",
      "severity": "low|medium|high",
      "explanation": "Why this change is needed",
      "confidence": 0.9
    }
  ]
}

Example position calculation:
If segment text is: "Tere, kuidas läheb täna?"
- To replace "kuidas": startChar=6, endChar=12
- To replace "täna": startChar=19, endChar=23
Remember: positions are 0-based and relative to segment start!`;

const ENHANCED_POSITION_ANALYSIS_PROMPT = `You are an expert transcript analyst. You have already performed an initial analysis.
Now you have ASR alternatives that may contain better transcriptions.

Original segments with positions:
{originalSegments}

Your initial analysis:
{initialAnalysis}

Alternative transcriptions from ASR:
{asrAlternatives}

CRITICAL: When suggesting changes based on ASR alternatives:
1. Map the ASR text to the ORIGINAL segment positions
2. Find where the ASR alternative differs from the original
3. Provide EXACT character positions relative to segment start
4. Always include segmentId, startChar, endChar

The ASR model excels at:
- Recognizing English words and phrases
- Handling code-switching between languages
- Technical terms and proper nouns

Create suggestions using the same position-based format:
{
  "segmentId": "speaker_0",
  "startChar": 10,
  "endChar": 25,
  "originalText": "text from original",
  "suggestedText": "better text from ASR",
  ...
}

Provide your enhanced analysis in {responseLanguage} language.`;

export class CoordinatingAgentPosition {
  private model;
  private asrTool: any = null;
  private webSearchTool;
  private positionTool: PositionAwareTipTapToolDirect;
  private editor: Editor | null = null;
  private reconciliationService: any = null;
  private currentSegments: PositionAwareSegment[] = [];
  
  constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3,
      maxTokens: 2000
    });
    
    this.webSearchTool = createWebSearchTool();
    this.positionTool = new PositionAwareTipTapToolDirect();
  }
  
  private async initializeASRTool() {
    if (this.asrTool) return;
    
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
    this.positionTool.setEditor(editor);
    this.reconciliationService = getReconciliationService(editor);
  }
  
  private cleanJsonString(str: string): string {
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');
  }
  
  async analyzeWithPositions(request: PositionAwareAnalysisRequest): Promise<PositionAwareAnalysisResult> {
    try {
      const { segments, summary, audioFilePath, fileId, uiLanguage } = request;
      
      // Store current segments for position mapping
      this.currentSegments = segments;
      this.positionTool.setSegments(segments);
      
      // Get document version for tracking
      const mapper = this.editor ? getPositionMapper(this.editor) : null;
      const documentVersion = mapper?.getVersion();
      
      // Normalize language
      const normalizedLanguage = normalizeLanguageCode(uiLanguage);
      const responseLanguage = getLanguageName(normalizedLanguage);
      
      // Format segments for LLM
      const formattedSegments = formatSegmentsForLLM(segments);
      const segmentsJson = JSON.stringify(formattedSegments, null, 2);
      
      // Build position-aware prompt
      const prompt = POSITION_AWARE_ANALYSIS_PROMPT
        .replace('{summary}', summary.summary)
        .replace('{segments}', segmentsJson)
        .replace('{responseLanguage}', responseLanguage);
      
      // Get initial analysis
      console.log('Sending position-aware analysis request...');
      const response = await this.model.invoke([new HumanMessage({ content: prompt })]);
      
      // Parse response
      let analysisData;
      try {
        const content = response.content as string;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        const cleanedJson = this.cleanJsonString(jsonMatch[0]);
        analysisData = JSON.parse(cleanedJson);
      } catch (e) {
        console.error('Failed to parse position-aware analysis:', e);
        analysisData = {
          analysis: response.content,
          confidence: 0.7,
          suggestions: []
        };
      }
      
      // Get ASR alternatives if needed
      let nBestResults = null;
      if (segments.length > 0 && segments[0].startTime !== undefined) {
        try {
          await this.initializeASRTool();
          
          if (this.asrTool) {
            const minTime = Math.min(...segments.map(s => s.startTime || 0));
            const maxTime = Math.max(...segments.map(s => s.endTime || 0));
            
            console.log('Fetching ASR alternatives for position-based analysis...');
            const asrResult = await this.asrTool._call({
              audioFilePath,
              startTime: minTime,
              endTime: maxTime,
              nBest: 5
            });
            nBestResults = JSON.parse(asrResult);
            
            // Enhance analysis with ASR results
            if (nBestResults?.alternatives?.length > 0) {
              const enhancedPrompt = ENHANCED_POSITION_ANALYSIS_PROMPT
                .replace('{originalSegments}', segmentsJson)
                .replace('{initialAnalysis}', JSON.stringify(analysisData.suggestions))
                .replace('{asrAlternatives}', JSON.stringify(nBestResults.alternatives))
                .replace('{responseLanguage}', responseLanguage);
              
              const enhancedResponse = await this.model.invoke([
                new HumanMessage({ content: enhancedPrompt })
              ]);
              
              try {
                const enhancedContent = enhancedResponse.content as string;
                const enhancedJsonMatch = enhancedContent.match(/\{[\s\S]*\}/);
                if (enhancedJsonMatch) {
                  const cleanedJson = this.cleanJsonString(enhancedJsonMatch[0]);
                  const enhancedData = JSON.parse(cleanedJson);
                  if (enhancedData.suggestions) {
                    analysisData.suggestions = enhancedData.suggestions;
                    analysisData.analysis = enhancedData.analysis || analysisData.analysis;
                  }
                }
              } catch (e) {
                console.error('Failed to parse enhanced position analysis:', e);
              }
            }
          }
        } catch (e) {
          console.error('ASR tool error in position-based analysis:', e);
        }
      }
      
      // Apply position-based suggestions
      const appliedSuggestions = [];
      let positionsUsedCount = 0;
      
      if (analysisData.suggestions && Array.isArray(analysisData.suggestions)) {
        for (const suggestion of analysisData.suggestions) {
          if (suggestion.confidence >= 0.5 && 
              suggestion.segmentId && 
              suggestion.startChar !== undefined && 
              suggestion.endChar !== undefined) {
            
            try {
              console.log(`Applying position-based suggestion in segment ${suggestion.segmentId}:`);
              console.log(`  Position: ${suggestion.startChar}-${suggestion.endChar}`);
              console.log(`  Original: "${suggestion.originalText}"`);
              console.log(`  Suggested: "${suggestion.suggestedText}"`);
              
              const result = await this.positionTool.applyPositionBasedChange({
                segmentId: suggestion.segmentId,
                startChar: suggestion.startChar,
                endChar: suggestion.endChar,
                originalText: suggestion.originalText || '',
                suggestedText: suggestion.suggestedText || '',
                changeType: suggestion.type || 'text_replacement',
                confidence: suggestion.confidence,
                context: suggestion.explanation || suggestion.text || ''
              });
              
              const positionResult = JSON.parse(result);
              
              if (positionResult.success) {
                positionsUsedCount++;
                appliedSuggestions.push({
                  ...suggestion,
                  applied: true,
                  positionBased: true,
                  mappingConfidence: positionResult.mappingConfidence,
                  fallbackUsed: positionResult.fallbackUsed,
                  diffId: positionResult.diffId
                });
                
                // Track in reconciliation service
                if (this.reconciliationService && documentVersion) {
                  this.reconciliationService.addPendingEdit({
                    id: positionResult.diffId,
                    type: 'suggestion',
                    from: positionResult.appliedAt,
                    to: positionResult.appliedAt + (suggestion.suggestedText?.length || 0),
                    originalText: suggestion.originalText,
                    suggestedText: suggestion.suggestedText,
                    segmentId: suggestion.segmentId,
                    confidence: suggestion.confidence,
                    version: documentVersion
                  });
                }
              } else {
                console.warn('Failed to apply position-based suggestion:', positionResult.error);
                appliedSuggestions.push({
                  ...suggestion,
                  applied: false,
                  positionBased: true,
                  error: positionResult.error
                });
              }
            } catch (error) {
              console.error('Error applying position-based suggestion:', error);
              appliedSuggestions.push({
                ...suggestion,
                applied: false,
                positionBased: true,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          } else {
            // No position information or low confidence
            appliedSuggestions.push({
              ...suggestion,
              applied: false,
              positionBased: false,
              requiresManualReview: true
            });
          }
        }
      }
      
      // Save to database
      const segmentIds = segments.map(s => s.id);
      
      for (const segment of segments) {
        if (segment.speakerId) {
          await prisma.analysisSegment.upsert({
            where: {
              fileId_segmentIndex: {
                fileId,
                segmentIndex: parseInt(segment.id.replace('speaker_', ''))
              }
            },
            create: {
              fileId,
              segmentIndex: parseInt(segment.id.replace('speaker_', '')),
              startTime: segment.startTime || 0,
              endTime: segment.endTime || 0,
              startWord: 0,
              endWord: segment.text.split(' ').length,
              originalText: segment.text,
              speakerName: segment.speakerName || 'Unknown',
              analysis: analysisData.analysis,
              suggestions: appliedSuggestions,
              nBestResults,
              status: 'analyzed'
            },
            update: {
              analysis: analysisData.analysis,
              suggestions: appliedSuggestions,
              nBestResults,
              status: 'analyzed'
            }
          });
        }
      }
      
      return {
        segmentIds,
        analysis: analysisData.analysis,
        suggestions: appliedSuggestions,
        nBestResults,
        confidence: analysisData.confidence,
        positionsUsed: positionsUsedCount > 0
      };
      
    } catch (error) {
      console.error('Position-aware analysis error:', error);
      throw new Error(
        `Failed to analyze with positions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  async getAnalyzedSegments(fileId: string): Promise<AnalysisSegment[]> {
    return prisma.analysisSegment.findMany({
      where: { fileId },
      orderBy: { segmentIndex: 'asc' }
    });
  }
  
  /**
   * Reconcile pending suggestions after document changes
   */
  async reconcilePendingSuggestions(): Promise<{
    reconciled: number;
    failed: number;
  }> {
    if (!this.reconciliationService) {
      return { reconciled: 0, failed: 0 };
    }
    
    const results = await this.reconciliationService.reconcileAllPending();
    
    let reconciled = 0;
    let failed = 0;
    
    results.forEach(result => {
      if (result.success) {
        reconciled++;
      } else {
        failed++;
      }
    });
    
    return { reconciled, failed };
  }
}

// Singleton instance
let positionAgentInstance: CoordinatingAgentPosition | null = null;

export function getPositionAwareAgent(modelName?: string): CoordinatingAgentPosition {
  if (!positionAgentInstance || modelName) {
    positionAgentInstance = new CoordinatingAgentPosition(modelName);
  }
  return positionAgentInstance;
}