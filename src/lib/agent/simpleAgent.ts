// Simplified ASR Agent for Phase 2 implementation
// This version focuses on the core logic without complex LangChain dependencies
import OpenAI from 'openai';
import { AGENT_CONFIG, isOpenRouterAvailable } from './config';
import { NERTool } from './nerTool';
import type { TextSegment, ExtractionStrategy, ExtractionOptions } from '$lib/components/editor/api/segmentExtraction';

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
  nerEntities?: Array<{
    text: string;
    label: string;
    confidence: string;
    potentialIssues: string[];
    suggestions: string[];
  }>;
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
    // Mock ASR response with Estonian text for better NER testing
    return {
      transcript: "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.",
      nBestList: [
        "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.",
        "Tallllinna Ülikooli rektor Tiit Landd kohtus Tartuu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.",
        "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas."
      ],
      confidenceScores: [0.85, 0.75, 0.65],
      wordTimings: [
        { word: "Tallinna", start: 0, end: 0.8, confidence: 0.9 },
        { word: "Ülikooli", start: 0.8, end: 1.5, confidence: 0.85 },
        { word: "rektor", start: 1.5, end: 2.0, confidence: 0.95 },
        { word: "Tiit", start: 2.0, end: 2.3, confidence: 0.7 },
        { word: "Land", start: 2.3, end: 2.8, confidence: 0.8 },
        { word: "kohtus", start: 2.8, end: 3.3, confidence: 0.9 },
        { word: "Tartu", start: 3.3, end: 3.8, confidence: 0.6 },
        { word: "Ülikooli", start: 3.8, end: 4.5, confidence: 0.5 },
        { word: "professor", start: 4.5, end: 5.2, confidence: 0.75 },
        { word: "Mart", start: 5.2, end: 5.6, confidence: 0.8 },
        { word: "Kulliga", start: 5.6, end: 6.2, confidence: 0.9 },
        { word: "Eesti", start: 6.2, end: 6.7, confidence: 0.95 },
        { word: "Teaduste", start: 6.7, end: 7.3, confidence: 0.85 },
        { word: "Akadeemias", start: 7.3, end: 8.0, confidence: 0.9 }
      ]
    };
  }
}

// Segment-based NER Analysis
class SegmentNERAnalysis {
  private nerTool: NERTool;

  constructor() {
    this.nerTool = new NERTool();
  }

  /**
   * Analyze segments using NER to identify potential entity issues
   */
  async analyzeSegmentsWithNER(segments: TextSegment[], language: string = 'et'): Promise<SegmentOfInterest[]> {
    const segmentsOfInterest: SegmentOfInterest[] = [];

    for (const segment of segments) {
      try {
        // Use NER tool to analyze the segment
        const nerResult = await this.nerTool.call(JSON.stringify({
          text: segment.text,
          language
        }));

        // Parse NER result to find problematic entities
        const problematicEntities = this.extractProblematicEntities(nerResult);
        
        if (problematicEntities.length > 0) {
          segmentsOfInterest.push({
            id: `ner_${segment.id}`,
            text: segment.text,
            start: segment.start,
            end: segment.end,
            reason: 'ner_issue',
            uncertaintyScore: this.calculateNERUncertainty(problematicEntities),
            confidenceScore: segment.metadata.confidence,
            nerEntities: problematicEntities,
            action: 'direct_correction',
            priority: this.calculateNERPriority(problematicEntities),
            categorizationReason: `Found ${problematicEntities.length} entities with potential issues`
          });
        }
      } catch (error) {
        console.error(`Error analyzing segment ${segment.id} with NER:`, error);
      }
    }

    return segmentsOfInterest;
  }

  /**
   * Extract entities with issues from NER result
   */
  private extractProblematicEntities(nerResult: string): Array<{
    text: string;
    label: string;
    confidence: string;
    potentialIssues: string[];
    suggestions: string[];
  }> {
    const entities: Array<{
      text: string;
      label: string;
      confidence: string;
      potentialIssues: string[];
      suggestions: string[];
    }> = [];

    try {
      // Parse the NER result to extract entity information
      // The NER tool returns a formatted string, so we need to parse it
      const lines = nerResult.split('\n');
      let currentEntity: any = null;

      for (const line of lines) {
        if (line.includes('🔴') || line.includes('🟡')) {
          // Start of a new entity
          if (currentEntity) {
            entities.push(currentEntity);
          }
          
          // Extract entity text and label
          const match = line.match(/[""]([^""]+)[""] \(([^)]+)\)/);
          if (match) {
            currentEntity = {
              text: match[1],
              label: match[2],
              confidence: line.includes('🔴') ? 'low' : 'medium',
              potentialIssues: [],
              suggestions: []
            };
          }
        } else if (currentEntity && line.includes('Issues:')) {
          // Extract issues
          const issuesMatch = line.match(/Issues: (.+)/);
          if (issuesMatch) {
            currentEntity.potentialIssues = issuesMatch[1].split(', ').filter(issue => issue !== 'None');
          }
        } else if (currentEntity && line.includes('Suggestions:')) {
          // Extract suggestions
          const suggestionsMatch = line.match(/Suggestions: (.+)/);
          if (suggestionsMatch) {
            currentEntity.suggestions = suggestionsMatch[1].split(', ').filter(suggestion => suggestion !== 'None');
          }
        }
      }

      // Add the last entity
      if (currentEntity) {
        entities.push(currentEntity);
      }
    } catch (error) {
      console.error('Error parsing NER result:', error);
    }

    return entities;
  }

  /**
   * Calculate uncertainty score based on NER entities
   */
  private calculateNERUncertainty(entities: Array<{ confidence: string; potentialIssues: string[] }>): number {
    let totalUncertainty = 0;
    
    for (const entity of entities) {
      let entityUncertainty = 0;
      
      // Base uncertainty from confidence
      if (entity.confidence === 'low') {
        entityUncertainty += 0.8;
      } else if (entity.confidence === 'medium') {
        entityUncertainty += 0.5;
      } else {
        entityUncertainty += 0.2;
      }
      
      // Additional uncertainty from issues
      entityUncertainty += entity.potentialIssues.length * 0.1;
      
      totalUncertainty += Math.min(entityUncertainty, 1.0);
    }
    
    return Math.min(totalUncertainty / entities.length, 1.0);
  }

  /**
   * Calculate priority score for NER issues
   */
  private calculateNERPriority(entities: Array<{ confidence: string; potentialIssues: string[] }>): number {
    let priority = 0;
    
    for (const entity of entities) {
      // Higher priority for low confidence entities
      if (entity.confidence === 'low') {
        priority += 3;
      } else if (entity.confidence === 'medium') {
        priority += 2;
      } else {
        priority += 1;
      }
      
      // Higher priority for entities with more issues
      priority += entity.potentialIssues.length;
    }
    
    return priority;
  }

  /**
   * Create text segments from ASR output for NER analysis
   */
  createSegmentsFromASR(asrOutput: ASROutput): TextSegment[] {
    const segments: TextSegment[] = [];
    
    // Create segments based on sentence boundaries
    const sentences = this.splitIntoSentences(asrOutput.transcript);
    let currentPosition = 0;
    
    sentences.forEach((sentence, index) => {
      if (sentence.trim()) {
        const start = currentPosition;
        const end = currentPosition + sentence.length;
        
        segments.push({
          id: `sentence_${index}`,
          text: sentence.trim(),
          start,
          end,
          metadata: {
            wordCount: sentence.split(' ').length,
            characterCount: sentence.length,
            hasTimestamps: true,
            marks: [],
            confidence: this.calculateSegmentConfidence(sentence, asrOutput.wordTimings, start, end)
          }
        });
        
        currentPosition = end + 1; // +1 for the space or punctuation
      }
    });
    
    return segments;
  }

  /**
   * Split transcript into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting for Estonian
    return text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  }

  /**
   * Calculate confidence for a segment based on word timings
   */
  private calculateSegmentConfidence(
    segmentText: string, 
    wordTimings: Array<{ word: string; confidence: number }>, 
    start: number, 
    end: number
  ): number {
    const segmentWords = segmentText.split(' ');
    let totalConfidence = 0;
    let wordCount = 0;
    
    for (const timing of wordTimings) {
      if (segmentWords.includes(timing.word)) {
        totalConfidence += timing.confidence;
        wordCount++;
      }
    }
    
    return wordCount > 0 ? totalConfidence / wordCount : 0.5;
  }
}

// LLM-based Error Detection
class LLMErrorDetection {
  private nerAnalysis: SegmentNERAnalysis;

  constructor() {
    this.nerAnalysis = new SegmentNERAnalysis();
  }

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

    // Use NER analysis on segments
    try {
      const textSegments = this.nerAnalysis.createSegmentsFromASR(asrOutput);
      const nerSegments = await this.nerAnalysis.analyzeSegmentsWithNER(textSegments, 'et');
      segments.push(...nerSegments);
    } catch (error) {
      console.error('Error in NER analysis:', error);
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