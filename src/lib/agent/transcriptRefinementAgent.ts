import { analyzeSegmentWithOpenRouter, suggestCorrectionsWithOpenRouter } from './llmUtils';
import { NERTool } from './nerTool';
import type { Word, Speaker } from '$lib/helpers/converters/types';

export interface SegmentAnalysis {
  segmentId: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker: string;
  nerAnalysis: any;
  llmSuggestions: string[];
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  corrections: Array<{
    original: string;
    suggested: string;
    confidence: number;
    reasoning: string;
  }>;
}

export interface TranscriptRefinementResult {
  fileId: string;
  totalSegments: number;
  analyzedSegments: number;
  segmentsWithIssues: number;
  segments: SegmentAnalysis[];
  summary: {
    totalCorrections: number;
    highPriorityIssues: number;
    entityIssues: number;
    confidenceIssues: number;
  };
  processingTime: number;
}

export class TranscriptRefinementAgent {
  private nerTool: NERTool;
  private mockMode: boolean;

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;
    this.nerTool = new NERTool();
  }

  async analyzeSegment(
    segmentText: string,
    segmentId: string,
    startTime: number,
    endTime: number,
    speaker: string
  ): Promise<SegmentAnalysis> {
    try {
      // Step 1: Run NER analysis
      const nerResults = await this.nerTool.call(JSON.stringify({
        text: segmentText,
        language: 'et'
      }));
      
      // Step 2: Run LLM analysis using OpenRouter
      let analysisText: string;
      if (!this.mockMode) {
        analysisText = await analyzeSegmentWithOpenRouter(segmentText, nerResults);
      } else {
        analysisText = `Mock Analysis for: "${segmentText}" ...`;
      }

      // Step 3: Generate specific corrections using OpenRouter
      let correctionText: string;
      if (!this.mockMode) {
        correctionText = await suggestCorrectionsWithOpenRouter(segmentText, nerResults, analysisText);
      } else {
        correctionText = JSON.stringify({ corrections: [], overallAssessment: 'Mock', priority: 'medium' });
      }

      // Parse correction suggestions
      let corrections = [];
      let confidence: 'high' | 'medium' | 'low' = 'medium';
      let issues: string[] = [];

      try {
        const parsedCorrections = JSON.parse(correctionText);
        corrections = parsedCorrections.corrections || [];
        // Extract issues from NER results
        if (nerResults.entities) {
          nerResults.entities.forEach((entity: any) => {
            if (entity.potentialIssues && entity.potentialIssues.length > 0) {
              issues.push(...entity.potentialIssues);
            }
            if (entity.confidence === 'low') {
              issues.push(`Low confidence entity: ${entity.text}`);
            }
          });
        }
        // Determine overall confidence
        const highConfidenceEntities = nerResults.entities?.filter((e: any) => e.confidence === 'high').length || 0;
        const totalEntities = nerResults.entities?.length || 0;
        if (corrections.length === 0 && highConfidenceEntities === totalEntities && totalEntities > 0) {
          confidence = 'high';
        } else if (corrections.length > 2 || issues.length > 3) {
          confidence = 'low';
        } else {
          confidence = 'medium';
        }
      } catch (parseError) {
        corrections = [];
      }

      return {
        segmentId,
        text: segmentText,
        startTime,
        endTime,
        speaker,
        nerAnalysis: nerResults,
        llmSuggestions: [analysisText],
        confidence,
        issues,
        corrections,
      };
    } catch (error) {
      console.error('Error in analyzeSegment:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        segmentText: segmentText.substring(0, 100) + '...'
      });
      
      return {
        segmentId,
        text: segmentText,
        startTime,
        endTime,
        speaker,
        nerAnalysis: { error: 'NER analysis failed' },
        llmSuggestions: [`Analysis failed: ${error.message}`],
        confidence: 'low',
        issues: ['Analysis error'],
        corrections: [],
      };
    }
  }

  async refineTranscript(
    fileId: string,
    words: Word[],
    speakers: Speaker[],
    content: any
  ): Promise<TranscriptRefinementResult> {
    const startTime = Date.now();
    
    try {
      // Extract segments from the transcript content
      const segments = this.extractSegments(content, words, speakers);
      
      console.log(`Starting transcript refinement for file ${fileId} with ${segments.length} segments`);

      // Analyze each segment
      const segmentAnalyses: SegmentAnalysis[] = [];
      let segmentsWithIssues = 0;

      for (const segment of segments) {
        const analysis = await this.analyzeSegment(
          segment.text,
          segment.id,
          segment.startTime,
          segment.endTime,
          segment.speaker
        );

        segmentAnalyses.push(analysis);
        
        if (analysis.issues.length > 0 || analysis.corrections.length > 0) {
          segmentsWithIssues++;
        }

        // Add a small delay to avoid overwhelming the APIs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Generate summary statistics
      const summary = {
        totalCorrections: segmentAnalyses.reduce((sum, seg) => sum + seg.corrections.length, 0),
        highPriorityIssues: segmentAnalyses.filter(seg => seg.confidence === 'low').length,
        entityIssues: segmentAnalyses.reduce((sum, seg) => 
          sum + seg.issues.filter(issue => issue.includes('entity')).length, 0),
        confidenceIssues: segmentAnalyses.reduce((sum, seg) => 
          sum + seg.issues.filter(issue => issue.includes('confidence')).length, 0),
      };

      const result: TranscriptRefinementResult = {
        fileId,
        totalSegments: segments.length,
        analyzedSegments: segmentAnalyses.length,
        segmentsWithIssues,
        segments: segmentAnalyses,
        summary,
        processingTime: Date.now() - startTime,
      };

      console.log(`Transcript refinement completed for file ${fileId}:`, {
        totalSegments: result.totalSegments,
        segmentsWithIssues: result.segmentsWithIssues,
        processingTime: result.processingTime,
      });

      return result;

    } catch (error) {
      console.error('Error in transcript refinement:', error);
      throw error;
    }
  }

  private extractSegments(content: any, words: Word[], speakers: Speaker[]): Array<{
    id: string;
    text: string;
    startTime: number;
    endTime: number;
    speaker: string;
  }> {
    const segments: Array<{
      id: string;
      text: string;
      startTime: number;
      endTime: number;
      speaker: string;
    }> = [];

    if (content && content.content) {
      // Handle TipTap editor format
      content.content.forEach((node: any, index: number) => {
        if (node.type === 'segment' && node.content) {
          const segmentText = node.content
            .map((inlineNode: any) => {
              if (inlineNode.type === 'text') {
                return inlineNode.text || '';
              }
              return '';
            })
            .join(' ')
            .trim();

          if (segmentText) {
            // Find start and end times for this segment
            const segmentWords = words.filter(word => 
              word.start >= (node.attrs?.start || 0) && 
              word.end <= (node.attrs?.end || Infinity)
            );

            const startTime = segmentWords.length > 0 ? segmentWords[0].start : 0;
            const endTime = segmentWords.length > 0 ? segmentWords[segmentWords.length - 1].end : 0;

            segments.push({
              id: `segment_${index}`,
              text: segmentText,
              startTime,
              endTime,
              speaker: node.attrs?.['data-name'] || 'Unknown',
            });
          }
        }
      });
    } else if (Array.isArray(content)) {
      // Handle array format (fallback)
      content.forEach((item: any, index: number) => {
        if (item.text) {
          segments.push({
            id: `segment_${index}`,
            text: item.text,
            startTime: item.start || 0,
            endTime: item.end || 0,
            speaker: item.speaker || 'Unknown',
          });
        }
      });
    }

    return segments;
  }
} 