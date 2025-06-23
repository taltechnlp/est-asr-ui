// Simplified ASR Agent for Phase 2 implementation
// This version focuses on the core logic without complex LangChain dependencies
import OpenAI from 'openai';
import { AGENT_CONFIG, isOpenRouterAvailable } from './config';

// Initialize OpenAI client for OpenRouter (only if API key is available)
let openai: OpenAI | null = null;

if (isOpenRouterAvailable()) {
  openai = new OpenAI({
    baseURL: AGENT_CONFIG.openRouter.baseURL,
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: AGENT_CONFIG.openRouter.headers
  });
} else {
  console.warn('OpenRouter API key not found. Agent will use rule-based fallbacks.');
}

export interface ASROutput {
  transcript: string;
  nBestList: string[];
  confidenceScores: number[];
  wordTimings: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface SegmentOfInterest {
  id: string;
  text: string;
  start: number;
  end: number;
  reason: 'low_confidence' | 'semantic_anomaly' | 'ner_issue' | 'nbest_variance';
  uncertaintyScore: number;
  confidenceScore?: number;
  nBestAlternatives?: string[];
  action?: 'web_search' | 'user_dialogue' | 'direct_correction';
  priority?: number;
  categorizationReason?: string;
}

export interface CorrectionSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  confidence: number;
  segmentId: string;
}

// Mock ASR Tool
class MockASRTool {
  async transcribe(audioFilePath: string): Promise<ASROutput> {
    // Mock ASR response
    return {
      transcript: "This is a sample transcript with some potential errors",
      nBestList: [
        "This is a sample transcript with some potential errors",
        "This is a sample transcription with some potential errors",
        "This is a sample transcript with some potential error"
      ],
      confidenceScores: [0.85, 0.75, 0.65],
      wordTimings: [
        { word: "This", start: 0, end: 0.5, confidence: 0.9 },
        { word: "is", start: 0.5, end: 0.8, confidence: 0.85 },
        { word: "a", start: 0.8, end: 1.0, confidence: 0.95 },
        { word: "sample", start: 1.0, end: 1.8, confidence: 0.7 },
        { word: "transcript", start: 1.8, end: 2.5, confidence: 0.8 },
        { word: "with", start: 2.5, end: 2.8, confidence: 0.9 },
        { word: "some", start: 2.8, end: 3.2, confidence: 0.6 },
        { word: "potential", start: 3.2, end: 4.0, confidence: 0.5 },
        { word: "errors", start: 4.0, end: 4.8, confidence: 0.75 }
      ]
    };
  }
}

// LLM-based Error Detection
class LLMErrorDetection {
  async detectErrors(asrOutput: ASROutput): Promise<SegmentOfInterest[]> {
    const segments: SegmentOfInterest[] = [];
    
    // First, detect low confidence words (rule-based)
    asrOutput.wordTimings.forEach((word, index) => {
      if (word.confidence < AGENT_CONFIG.thresholds.lowConfidence) {
        segments.push({
          id: `low_conf_${index}`,
          text: word.word,
          start: word.start,
          end: word.end,
          reason: 'low_confidence',
          uncertaintyScore: 1 - word.confidence,
          confidenceScore: word.confidence
        });
      }
    });

    // Detect N-best variance (rule-based)
    if (asrOutput.nBestList.length > 1) {
      const words1 = asrOutput.nBestList[0].split(' ');
      const words2 = asrOutput.nBestList[1].split(' ');
      
      for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
        if (words1[i] !== words2[i]) {
          segments.push({
            id: `nbest_var_${i}`,
            text: words1[i],
            start: i * 0.5, // Approximate timing
            end: (i + 1) * 0.5,
            reason: 'nbest_variance',
            uncertaintyScore: 0.8,
            nBestAlternatives: [words1[i], words2[i]]
          });
        }
      }
    }

    // Use LLM for semantic analysis
    try {
      const semanticSegments = await this.detectSemanticIssues(asrOutput.transcript);
      segments.push(...semanticSegments);
    } catch (error) {
      console.error('Error in semantic analysis:', error);
    }

    return segments;
  }

  private async detectSemanticIssues(transcript: string): Promise<SegmentOfInterest[]> {
    // If OpenRouter is not available, return empty array
    if (!openai) {
      console.log('OpenRouter not available, skipping semantic analysis');
      return [];
    }

    try {
      const response = await openai.chat.completions.create({
        model: AGENT_CONFIG.openRouter.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing ASR transcripts for potential errors. 
            Identify segments that may have semantic anomalies, awkward phrasing, or potential factual inaccuracies.
            Return only a JSON array of problematic segments.`
          },
          {
            role: 'user',
            content: `Analyze this transcript for potential issues:
            
            Transcript: "${transcript}"
            
            Return a JSON array with this structure:
            [
              {
                "id": "semantic_1",
                "text": "problematic text segment",
                "start": 0,
                "end": 10,
                "reason": "semantic_anomaly",
                "uncertaintyScore": 0.8,
                "description": "explanation of the issue"
              }
            ]
            
            Only return valid JSON, no additional text.`
          }
        ],
        temperature: AGENT_CONFIG.openRouter.temperature,
        max_tokens: AGENT_CONFIG.openRouter.maxTokens
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          const semanticIssues = JSON.parse(content);
          return semanticIssues.map((issue: any) => ({
            id: issue.id,
            text: issue.text,
            start: issue.start,
            end: issue.end,
            reason: issue.reason as 'semantic_anomaly',
            uncertaintyScore: issue.uncertaintyScore,
            categorizationReason: issue.description
          }));
        } catch (parseError) {
          console.error('Failed to parse semantic analysis result:', parseError);
          return [];
        }
      }
    } catch (error) {
      console.error('Error calling OpenRouter for semantic analysis:', error);
    }

    return [];
  }
}

// LLM-based Information Augmentation Controller
class LLMAugmentationController {
  async categorizeSOI(segment: SegmentOfInterest, context: string): Promise<{
    action: 'web_search' | 'user_dialogue' | 'direct_correction';
    reason: string;
    priority: number;
  }> {
    // If OpenRouter is not available, use fallback categorization
    if (!openai) {
      console.log('OpenRouter not available, using fallback categorization');
      return this.getFallbackCategorization(segment);
    }

    try {
      const response = await openai.chat.completions.create({
        model: AGENT_CONFIG.openRouter.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert at categorizing segments of interest in ASR transcripts. 
            Analyze each segment and decide the best approach for correction.`
          },
          {
            role: 'user',
            content: `Analyze this segment of interest and categorize it:
            
            Segment: ${JSON.stringify(segment)}
            Context: "${context}"
            
            Categorize this SOI and recommend the next action:
            1. "web_search" - High uncertainty, factual query, or named entity verification needed
            2. "user_dialogue" - Moderate uncertainty, ambiguity, or multiple valid interpretations  
            3. "direct_correction" - Low uncertainty, likely simple fix
            
            Return JSON:
            {
              "action": "web_search|user_dialogue|direct_correction",
              "reason": "explanation of the decision",
              "priority": 1-5
            }
            
            Only return valid JSON, no additional text.`
          }
        ],
        temperature: AGENT_CONFIG.openRouter.temperature,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          return JSON.parse(content);
        } catch (parseError) {
          console.error('Failed to parse categorization result:', parseError);
          return this.getFallbackCategorization(segment);
        }
      }
    } catch (error) {
      console.error('Error calling OpenRouter for categorization:', error);
    }

    return this.getFallbackCategorization(segment);
  }

  private getFallbackCategorization(segment: SegmentOfInterest): {
    action: 'web_search' | 'user_dialogue' | 'direct_correction';
    reason: string;
    priority: number;
  } {
    // Fallback rule-based categorization
    if (segment.uncertaintyScore > AGENT_CONFIG.thresholds.highUncertainty) {
      return {
        action: 'web_search',
        reason: 'High uncertainty requires external verification',
        priority: 5
      };
    } else if (segment.uncertaintyScore > AGENT_CONFIG.thresholds.moderateUncertainty) {
      return {
        action: 'user_dialogue',
        reason: 'Moderate uncertainty requires user input',
        priority: 3
      };
    } else {
      return {
        action: 'direct_correction',
        reason: 'Low uncertainty, can attempt direct correction',
        priority: 1
      };
    }
  }
}

// Main ASR Agent Class
export class SimpleASRAgent {
  private errorDetection: LLMErrorDetection;
  private augmentationController: LLMAugmentationController;
  private asrTool: MockASRTool;

  constructor() {
    this.errorDetection = new LLMErrorDetection();
    this.augmentationController = new LLMAugmentationController();
    this.asrTool = new MockASRTool();
  }

  async processAudio(audioFilePath: string): Promise<{
    transcript: string;
    segmentsOfInterest: SegmentOfInterest[];
    processingSteps: string[];
  }> {
    const processingSteps: string[] = [];
    
    try {
      // Step 1: ASR Transcription
      processingSteps.push('Starting ASR transcription...');
      const asrOutput = await this.asrTool.transcribe(audioFilePath);
      processingSteps.push('ASR transcription completed');

      // Step 2: Error Detection
      processingSteps.push('Analyzing transcript for potential errors...');
      const segmentsOfInterest = await this.errorDetection.detectErrors(asrOutput);
      processingSteps.push(`Found ${segmentsOfInterest.length} segments of interest`);

      // Step 3: Categorize and prioritize SOIs
      processingSteps.push('Categorizing segments for processing...');
      const categorizedSOIs: SegmentOfInterest[] = [];
      
      for (const segment of segmentsOfInterest) {
        const categorization = await this.augmentationController.categorizeSOI(
          segment,
          asrOutput.transcript
        );
        categorizedSOIs.push({
          ...segment,
          action: categorization.action,
          priority: categorization.priority,
          categorizationReason: categorization.reason
        });
      }

      // Sort by priority
      categorizedSOIs.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      return {
        transcript: asrOutput.transcript,
        segmentsOfInterest: categorizedSOIs,
        processingSteps
      };

    } catch (error) {
      console.error('Error in ASR agent processing:', error);
      processingSteps.push(`Error: ${error.message}`);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    console.log('Initializing Simple ASR Agent...');
    // Add any initialization logic here
  }
}

// Singleton instance
let agentInstance: SimpleASRAgent | null = null;

export async function getSimpleASRAgent(): Promise<SimpleASRAgent> {
  if (!agentInstance) {
    agentInstance = new SimpleASRAgent();
    await agentInstance.initialize();
  }
  return agentInstance;
} 