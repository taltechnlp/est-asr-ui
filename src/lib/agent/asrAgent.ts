import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { Tool } from 'langchain/tools';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Types for the ASR agent
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

// ASR Tool - calls the existing ASR service
class ASRTool extends Tool {
  name = 'asr_transcription';
  description = 'Transcribes audio files using the ASR service';

  constructor() {
    super();
  }

  async _call(input: string): Promise<string> {
    // This would call the existing /api/transcribe endpoint
    // For now, return a mock response
    return JSON.stringify({
      transcript: "This is a sample transcript",
      nBestList: ["This is a sample transcript", "This is a sample transcription"],
      confidenceScores: [0.85, 0.75],
      wordTimings: [
        { word: "This", start: 0, end: 0.5, confidence: 0.9 },
        { word: "is", start: 0.5, end: 0.8, confidence: 0.85 },
        { word: "a", start: 0.8, end: 1.0, confidence: 0.95 },
        { word: "sample", start: 1.0, end: 1.8, confidence: 0.7 },
        { word: "transcript", start: 1.8, end: 2.5, confidence: 0.8 }
      ]
    });
  }
}

// Error Detection Chain
class ErrorDetectionChain {
  private llm: ChatOpenAI;
  private prompt: PromptTemplate;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
    });

    this.prompt = PromptTemplate.fromTemplate(`
      Analyze the following ASR transcript for potential errors and issues.
      
      Transcript: {transcript}
      Confidence scores: {confidenceScores}
      N-best alternatives: {nBestList}
      
      Identify segments of interest (SOIs) that may need correction. Look for:
      1. Words with low confidence scores (< 0.7)
      2. Semantic anomalies or awkward phrasing
      3. Potential factual inaccuracies
      4. Named entities that seem misspelled
      5. Significant variations in N-best alternatives
      
      Return a JSON array of SOIs with the following structure:
      [
        {
          "id": "unique_id",
          "text": "problematic text segment",
          "start": start_position,
          "end": end_position,
          "reason": "low_confidence|semantic_anomaly|ner_issue|nbest_variance",
          "uncertaintyScore": 0.0-1.0,
          "confidenceScore": 0.0-1.0,
          "nBestAlternatives": ["alt1", "alt2"]
        }
      ]
      
      Only return valid JSON, no additional text.
    `);
  }

  async detectErrors(asrOutput: ASROutput): Promise<SegmentOfInterest[]> {
    const formattedPrompt = await this.prompt.format({
      transcript: asrOutput.transcript,
      confidenceScores: JSON.stringify(asrOutput.confidenceScores),
      nBestList: JSON.stringify(asrOutput.nBestList)
    });
    
    const result = await this.llm.invoke(formattedPrompt);

    try {
      return JSON.parse(result.content as string);
    } catch (error) {
      console.error('Failed to parse error detection result:', error);
      return [];
    }
  }
}

// Information Augmentation Controller
class InformationAugmentationController {
  private llm: ChatOpenAI;
  private prompt: PromptTemplate;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
    });

    this.prompt = PromptTemplate.fromTemplate(`
      Analyze the following segment of interest and decide the best approach for correction.
      
      Segment: {segment}
      Context: {context}
      
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
    `);
  }

  async categorizeSOI(segment: SegmentOfInterest, context: string): Promise<{
    action: 'web_search' | 'user_dialogue' | 'direct_correction';
    reason: string;
    priority: number;
  }> {
    const formattedPrompt = await this.prompt.format({
      segment: JSON.stringify(segment),
      context
    });
    
    const result = await this.llm.invoke(formattedPrompt);

    try {
      return JSON.parse(result.content as string);
    } catch (error) {
      console.error('Failed to parse categorization result:', error);
      return {
        action: 'user_dialogue',
        reason: 'Fallback to user dialogue due to parsing error',
        priority: 3
      };
    }
  }
}

// Main ASR Agent Class
export class ASRAgent {
  private errorDetectionChain: ErrorDetectionChain;
  private augmentationController: InformationAugmentationController;
  private asrTool: ASRTool;

  constructor() {
    this.errorDetectionChain = new ErrorDetectionChain();
    this.augmentationController = new InformationAugmentationController();
    this.asrTool = new ASRTool();
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
      const asrResult = await this.asrTool._call(audioFilePath);
      const asrOutput: ASROutput = JSON.parse(asrResult);
      processingSteps.push('ASR transcription completed');

      // Step 2: Error Detection
      processingSteps.push('Analyzing transcript for potential errors...');
      const segmentsOfInterest = await this.errorDetectionChain.detectErrors(asrOutput);
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
    // Initialize the agent components
    console.log('Initializing ASR Agent...');
    // Add any initialization logic here
  }
}

// Singleton instance
let agentInstance: ASRAgent | null = null;

export async function getASRAgent(): Promise<ASRAgent> {
  if (!agentInstance) {
    agentInstance = new ASRAgent();
    await agentInstance.initialize();
  }
  return agentInstance;
} 