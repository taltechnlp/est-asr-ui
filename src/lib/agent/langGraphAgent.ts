// LangGraph-based ASR Agent
// This replaces the SimpleASRAgent with a graph-based architecture for better flow control

import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { AGENT_CONFIG, isOpenRouterAvailable } from './config';
import { parseJsonFromLLM } from './llmUtils';
import { NERTool } from './nerTool';
import { WebSearchTool } from './webSearchTool';
import type { TextSegment } from '$lib/components/editor/api/segmentExtraction';
import OpenAI from 'openai';

// Initialize OpenAI client for OpenRouter
let openai: OpenAI | null = null;
if (isOpenRouterAvailable()) {
  openai = new OpenAI({
    baseURL: AGENT_CONFIG.openRouter.baseURL,
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: AGENT_CONFIG.openRouter.headers
  });
  console.log('🔧 LangGraphAgent: OpenRouter client initialized with model:', AGENT_CONFIG.openRouter.model);
} else {
  console.warn('⚠️ LangGraphAgent: OpenRouter API key not found. Agent will use rule-based fallbacks.');
}

// State interface for the agent graph
export interface ASRAgentState {
  // Input
  audioFilePath: string;
  language: string;

  // ASR Results
  transcript?: string;
  nBestList?: string[];
  confidenceScores?: number[];
  wordTimings?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;

  // Web Search Results
  searchResults?: Array<{
    query: string;
    verified: boolean;
    confidence: number;
    evidence: string[];
    summary: string;
  }>;
  contextualInfo?: string;
  verifiedEntities?: string[];

  // NER Results
  textSegments?: TextSegment[];
  nerSegments?: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
    reason: 'ner_issue';
    uncertaintyScore: number;
    nerEntities: Array<{
      text: string;
      label: string;
      confidence: string;
      potentialIssues: string[];
      suggestions: string[];
    }>;
  }>;

  // Error Detection Results
  segmentsOfInterest?: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
    reason: 'low_confidence' | 'semantic_anomaly' | 'ner_issue' | 'nbest_variance' | 'web_search_verified';
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
    webSearchResults?: {
      query: string;
      verified: boolean;
      confidence: number;
      evidence: string[];
      summary: string;
    };
  }>;

  // Processing metadata
  processingSteps: string[];
  totalSegments?: number;
  segmentsWithIssues?: number;
  processingTime?: number;

  // Error handling
  errors?: string[];
}

// Helper function to add processing step and log
function addProcessingStep(state: ASRAgentState, step: string): void {
  state.processingSteps.push(step);
  console.log(`📋 LangGraphAgent: ${step}`);
}

// Node 1: ASR Transcription
async function asrNode(state: ASRAgentState): Promise<Partial<ASRAgentState>> {
  addProcessingStep(state, "Starting ASR transcription");
  
  try {
    // Check if we already have real transcript content
    if (state.transcript) {
      addProcessingStep(state, `ASR using provided transcript: ${state.transcript.length} chars`);
      console.log(`🎯 LangGraphAgent ASR: Using REAL transcript content: "${state.transcript.substring(0, 100)}..."`);
      
      // Use the provided real content
      return {
        transcript: state.transcript,
        nBestList: [state.transcript], // Simple N-best with just the main transcript
        confidenceScores: [0.85], // Default confidence for real content
        wordTimings: state.wordTimings || []
      };
    }

    // Fallback to mock data if no real content provided (for testing)
    console.log(`⚠️ LangGraphAgent ASR: No real content provided, using mock data`);
    const asrResult = {
      transcript: "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.",
      nBestList: [
        "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.",
        "Tallllinna Ülikooli rektor Tiit Landd kohtus Tartuu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas."
      ],
      confidenceScores: [0.85, 0.75],
      wordTimings: [
        { word: "Tallinna", start: 0, end: 0.8, confidence: 0.9 },
        { word: "Ülikooli", start: 0.8, end: 1.5, confidence: 0.85 },
        { word: "rektor", start: 1.5, end: 2.0, confidence: 0.95 },
        { word: "Tiit", start: 2.0, end: 2.3, confidence: 0.7 },
        { word: "Land", start: 2.3, end: 2.8, confidence: 0.8 }
      ]
    };

    addProcessingStep(state, `ASR completed: ${asrResult.transcript.length} chars transcribed (mock data)`);
    
    return {
      transcript: asrResult.transcript,
      nBestList: asrResult.nBestList,
      confidenceScores: asrResult.confidenceScores,
      wordTimings: asrResult.wordTimings
    };

  } catch (error) {
    const errorMsg = `ASR transcription failed: ${error.message}`;
    addProcessingStep(state, errorMsg);
    return {
      errors: [...(state.errors || []), errorMsg]
    };
  }
}

// Node 2: Web Search Analysis  
async function webSearchNode(state: ASRAgentState): Promise<Partial<ASRAgentState>> {
  addProcessingStep(state, "Starting web search analysis");
  
  if (!state.transcript) {
    const errorMsg = "No transcript available for web search";
    return { errors: [...(state.errors || []), errorMsg] };
  }

  try {
    const webSearchTool = new WebSearchTool();
    const contextCache = new Map<string, string>();

    // Use entities identified by NER instead of generating queries from raw transcript
    let searchQueries: string[] = [];
    
    if (state.nerSegments && state.nerSegments.length > 0) {
      // Extract entity names from NER results for web search
      searchQueries = state.nerSegments
        .flatMap(segment => segment.nerEntities.map(entity => entity.text))
        .filter(entity => entity && entity.length > 2)
        .filter(entity => !isCommonEstonianWord(entity)) // Filter out common Estonian words
        .slice(0, 5); // Limit to 5 searches to avoid timeouts
      
      console.log(`🔍 LangGraphAgent: Using NER-identified entities for search: ${searchQueries.join(', ')}`);
    } else {
      // Fallback: Generate search queries from transcript but with better filtering
      const allQueries = generateSearchQueries(state.transcript);
      searchQueries = allQueries
        .filter(query => !isCommonEstonianWord(query))
        .slice(0, 3); // Even more limited fallback to avoid timeouts
      
      console.log(`🔍 LangGraphAgent: Generated filtered search queries: ${searchQueries.join(', ')}`);
    }

    if (searchQueries.length === 0) {
      console.log(`⚠️ LangGraphAgent: No valid entities found for web search`);
      return {
        searchResults: [],
        contextualInfo: "No entities identified for web search verification.",
        verifiedEntities: []
      };
    }

    const searchResults: Array<{
      query: string;
      verified: boolean;
      confidence: number;
      evidence: string[];
      summary: string;
    }> = [];

    // Perform searches sequentially to avoid DuckDuckGo rate limits
    console.log(`🕐 LangGraphAgent: Performing ${searchQueries.length} searches sequentially to avoid timeouts...`);
    
    for (let i = 0; i < searchQueries.length; i++) {
      const query = searchQueries[i];
      
      try {
        const context = await generateSearchContext(query, state.language, contextCache);
        const searchInput = JSON.stringify({
          query,
          context,
          maxResults: 2 // Reduce results to speed up searches
        });
        
        console.log(`➡️ LangGraphAgent Web Search ${i + 1}/${searchQueries.length}: ${query}${context ? ` (context: ${context})` : ''}`);
        
        // Add timeout to individual searches - increased for DuckDuckGo reliability
        const searchPromise = webSearchTool.call(searchInput);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 20000) // Increased to 20 seconds
        );
        
        const result = await Promise.race([searchPromise, timeoutPromise]) as string;
        
        const verified = result.includes('✅') && !result.includes('❌');
        const confidenceMatch = result.match(/Entity verification: (\d+)\/(\d+) entities verified/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / parseInt(confidenceMatch[2]) : 0.5;
        
        searchResults.push({
          query,
          verified,
          confidence,
          evidence: extractEvidence(result),
          summary: extractSummary(result)
        });
        
        console.log(`✅ LangGraphAgent: Search ${i + 1} completed for "${query}"`);
        
        // Add delay between searches to respect rate limits
        if (i < searchQueries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay for better rate limiting
        }
        
      } catch (error) {
        console.error(`❌ LangGraphAgent: Web search ${i + 1} failed for "${query}":`, error.message);
        searchResults.push({
          query,
          verified: false,
          confidence: 0,
          evidence: [],
          summary: `Search failed: ${error.message}`
        });
        
        // Still add delay even on failure
        if (i < searchQueries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    const verifiedQueries = searchResults.filter(r => r.verified).map(r => r.query);
    const contextualInfo = generateContextualSummary(searchResults);
    
    addProcessingStep(state, `Web search completed: ${verifiedQueries.length}/${searchResults.length} entities verified`);
    
    return {
      searchResults,
      contextualInfo,
      verifiedEntities: verifiedQueries
    };

  } catch (error) {
    const errorMsg = `Web search analysis failed: ${error.message}`;
    addProcessingStep(state, errorMsg);
    return {
      errors: [...(state.errors || []), errorMsg]
    };
  }
}

// Node 3: NER Analysis
async function nerNode(state: ASRAgentState): Promise<Partial<ASRAgentState>> {
  addProcessingStep(state, "Starting NER analysis");
  
  if (!state.transcript) {
    const errorMsg = "No transcript available for NER analysis";
    return { errors: [...(state.errors || []), errorMsg] };
  }

  try {
    const nerTool = new NERTool();
    
    // Create text segments from transcript
    const textSegments = createSegmentsFromTranscript(state.transcript, state.wordTimings || []);
    
    // Analyze segments with NER
    const nerResults: Array<{
      id: string;
      text: string;
      start: number;
      end: number;
      reason: 'ner_issue';
      uncertaintyScore: number;
      nerEntities: Array<{
        text: string;
        label: string;
        confidence: string;
        potentialIssues: string[];
        suggestions: string[];
      }>;
    }> = [];

    for (const segment of textSegments) {
      try {
        const nerInput = JSON.stringify({
          text: segment.text,
          language: state.language || 'et',
          includeMetadata: true
        });
        
        const nerResult = await nerTool.call(nerInput);
        const entities = extractProblematicEntities(nerResult);
        
        if (entities.length > 0) {
          nerResults.push({
            id: segment.id,
            text: segment.text,
            start: segment.start || 0,
            end: segment.end || 0,
            reason: 'ner_issue',
            uncertaintyScore: calculateNERUncertainty(entities),
            nerEntities: entities
          });
        }
      } catch (error) {
        console.error(`❌ LangGraphAgent: NER analysis failed for segment "${segment.text}":`, error);
      }
    }

    addProcessingStep(state, `NER analysis completed: ${nerResults.length} segments with entity issues`);
    
    return {
      textSegments,
      nerSegments: nerResults
    };

  } catch (error) {
    const errorMsg = `NER analysis failed: ${error.message}`;
    addProcessingStep(state, errorMsg);
    return {
      errors: [...(state.errors || []), errorMsg]
    };
  }
}

// Node 4: Error Detection
async function errorDetectionNode(state: ASRAgentState): Promise<Partial<ASRAgentState>> {
  addProcessingStep(state, "Starting error detection");
  
  try {
    const segmentsOfInterest: Array<{
      id: string;
      text: string;
      start: number;
      end: number;
      reason: 'low_confidence' | 'semantic_anomaly' | 'ner_issue' | 'nbest_variance' | 'web_search_verified';
      uncertaintyScore: number;
      confidenceScore?: number;
      nBestAlternatives?: string[];
      action?: 'web_search' | 'user_dialogue' | 'direct_correction';
      priority?: number;
      categorizationReason?: string;
      nerEntities?: any[];
      webSearchResults?: any;
    }> = [];

    // Add NER segments as segments of interest
    if (state.nerSegments) {
      segmentsOfInterest.push(...state.nerSegments);
    }

    // Add low confidence segments
    if (state.wordTimings) {
      const lowConfidenceSegments = detectLowConfidenceSegments(
        state.transcript || '',
        state.wordTimings,
        AGENT_CONFIG.thresholds.lowConfidence
      );
      segmentsOfInterest.push(...lowConfidenceSegments);
    }

    // Add web search verified entities as segments
    if (state.searchResults && state.verifiedEntities) {
      const webSearchSegments = createWebSearchSegments(
        state.transcript || '',
        state.searchResults,
        state.verifiedEntities
      );
      segmentsOfInterest.push(...webSearchSegments);
    }

    // Detect semantic issues using LLM
    if (openai && state.transcript) {
      const semanticSegments = await detectSemanticIssues(state.transcript);
      segmentsOfInterest.push(...semanticSegments);
    }

    addProcessingStep(state, `Error detection completed: ${segmentsOfInterest.length} segments of interest identified`);
    
    return {
      segmentsOfInterest,
      totalSegments: state.textSegments?.length || 0,
      segmentsWithIssues: segmentsOfInterest.length
    };

  } catch (error) {
    const errorMsg = `Error detection failed: ${error.message}`;
    addProcessingStep(state, errorMsg);
    return {
      errors: [...(state.errors || []), errorMsg]
    };
  }
}

// Node 5: Categorization
async function categorizationNode(state: ASRAgentState): Promise<Partial<ASRAgentState>> {
  addProcessingStep(state, "Starting segment categorization");
  
  if (!state.segmentsOfInterest) {
    addProcessingStep(state, "No segments of interest to categorize");
    return {};
  }

  try {
    const categorizedSegments = [...state.segmentsOfInterest];
    
    // Categorize each segment using LLM if available
    if (openai) {
      for (const segment of categorizedSegments) {
        try {
          const categorization = await categorizeSegment(segment, state.contextualInfo || '');
          segment.action = categorization.action;
          segment.priority = categorization.priority;
          segment.categorizationReason = categorization.reason;
        } catch (error) {
          console.error(`❌ LangGraphAgent: Categorization failed for segment "${segment.text}":`, error);
          // Use fallback categorization
          const fallback = getFallbackCategorization(segment);
          segment.action = fallback.action;
          segment.priority = fallback.priority;
          segment.categorizationReason = fallback.reason;
        }
      }
    }

    addProcessingStep(state, `Categorization completed: ${categorizedSegments.length} segments categorized`);
    
    return {
      segmentsOfInterest: categorizedSegments
    };

  } catch (error) {
    const errorMsg = `Categorization failed: ${error.message}`;
    addProcessingStep(state, errorMsg);
    return {
      errors: [...(state.errors || []), errorMsg]
    };
  }
}

// Estonian language helper function
function isCommonEstonianWord(word: string): boolean {
  const commonEstonianWords = new Set([
    // Pronouns
    'mina', 'sina', 'tema', 'meie', 'teie', 'nemad',
    'ma', 'sa', 'ta', 'me', 'te', 'nad',
    'see', 'need', 'seda', 'selle', 'selle',
    
    // Common verbs
    'on', 'oli', 'olen', 'oled', 'oleme', 'olete',
    'ütles', 'ütleb', 'rääkis', 'rääkima', 'räägin',
    'teeb', 'tegi', 'teen', 'teed', 'teeme', 'teete',
    
    // Common nouns/adjectives
    'aeg', 'päev', 'nädal', 'kuu', 'aasta',
    'hea', 'halb', 'suur', 'väike', 'uus', 'vana',
    'kodu', 'töö', 'kool', 'pere',
    
    // Conjunctions/prepositions
    'ja', 'või', 'aga', 'kui', 'et', 'sest',
    'pärast', 'enne', 'kuni', 'peale',
    'kõik', 'mitte', 'väga', 'ka', 'siis',
    
    // Articles/determiners
    'üks', 'kaks', 'kolm', 'neli', 'viis',
    'esimene', 'teine', 'kolmas',
    
    // Common expressions
    'tere', 'aitäh', 'palun', 'vabandust',
    'jah', 'ei', 'hästi', 'halvasti'
  ]);
  
  return commonEstonianWords.has(word.toLowerCase());
}

// Helper functions (extracted from SimpleASRAgent)
function generateSearchQueries(transcript: string): string[] {
  const queries: string[] = [];
  
  // Extract named entities
  const entityRegex = /\b[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+(?:\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+)*\b/g;
  const entities = transcript.match(entityRegex) || [];
  const uniqueEntities = [...new Set(entities)].filter(entity => 
    entity.length > 3 && !['Eesti', 'Estonia', 'Estonian'].includes(entity)
  );
  queries.push(...uniqueEntities.slice(0, 5));
  
  // Extract organizations
  const orgRegex = /\b([A-ZÄÖÜÕŠŽ][a-zäöüõšž]+\s+)?(?:Ülikool|University|Akadeemia|Academy|Instituut|Institute)\b/g;
  const orgs = transcript.match(orgRegex) || [];
  queries.push(...orgs.slice(0, 2));
  
  // Extract titles/positions
  const titleRegex = /\b(?:rektor|professor|direktor|minister|president|juhataja)\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+/gi;
  const titles = transcript.match(titleRegex) || [];
  queries.push(...titles.slice(0, 2));
  
  return [...new Set(queries)].slice(0, 8);
}

async function generateSearchContext(query: string, language: string, cache: Map<string, string>): Promise<string> {
  if (query.length < 3 || !openai) return '';

  const cacheKey = `${query.toLowerCase()}_${language}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const prompt = `Analyze this search query and determine if it needs geographical/language context for web search:

Query: "${query}"
Source language: ${language === 'et' ? 'Estonian' : language}

Determine if this query would benefit from adding geographical or language context (like "Estonia" or "Estonian") to get more relevant search results.

Consider:
- Is this query already location-specific? (e.g., "Tartu Ülikool" is already clearly Estonian)
- Is this a person with a clear local title? (e.g., "rektor Tiit Land" is clearly Estonian context)
- Is this an organization that's obviously local? (e.g., "Eesti Teaduste Akadeemia")
- Would the query be ambiguous without context? (e.g., "Land" might need "Estonia" context)

Respond with JSON:
{
  "needsContext": true/false,
  "suggestedContext": "Estonia" or "Estonian" or "",
  "reasoning": "brief explanation"
}`;

    const response = await openai.chat.completions.create({
      model: AGENT_CONFIG.openRouter.model,
      messages: [
        { role: 'system', content: 'You are an expert at optimizing web search queries. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 150
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const result = parseJsonFromLLM(content);
      const context = result.needsContext ? (result.suggestedContext || '') : '';
      cache.set(cacheKey, context);
      console.log(`🎯 LangGraphAgent Context Decision: "${query}" → ${context ? `"${context}"` : 'no context'} - ${result.reasoning}`);
      return context;
    }
  } catch (error) {
    console.error(`❌ LangGraphAgent: Context generation failed for "${query}":`, error.message);
  }

  cache.set(cacheKey, '');
  return '';
}

function extractEvidence(result: string): string[] {
  const evidence: string[] = [];
  const snippetRegex = /📝 ([^🔗]+)/g;
  let match;
  while ((match = snippetRegex.exec(result)) !== null) {
    if (match[1] && match[1].trim()) {
      evidence.push(match[1].trim().substring(0, 200));
    }
  }
  return evidence.slice(0, 3);
}

function extractSummary(result: string): string {
  const consensusMatch = result.match(/Consensus: ([^\\n]+)/);
  if (consensusMatch && consensusMatch[1]) {
    return consensusMatch[1].trim().substring(0, 300);
  }
  const snippetMatch = result.match(/📝 ([^🔗]+)/);
  if (snippetMatch && snippetMatch[1]) {
    return snippetMatch[1].trim().substring(0, 200) + '...';
  }
  return 'No summary available';
}

function generateContextualSummary(searchResults: Array<{
  query: string;
  verified: boolean;
  confidence: number;
  evidence: string[];
  summary: string;
}>): string {
  const verifiedResults = searchResults.filter(r => r.verified);
  const totalConfidence = searchResults.reduce((sum, r) => sum + r.confidence, 0) / searchResults.length;
  
  let summary = `Web search context analysis:\n`;
  summary += `- Searched ${searchResults.length} entities/queries\n`;
  summary += `- ${verifiedResults.length} verified with web sources\n`;
  summary += `- Average confidence: ${(totalConfidence * 100).toFixed(1)}%\n\n`;
  
  if (verifiedResults.length > 0) {
    summary += `Verified entities: ${verifiedResults.map(r => r.query).join(', ')}\n\n`;
    summary += `Key findings:\n`;
    verifiedResults.slice(0, 3).forEach((result, i) => {
      summary += `${i + 1}. ${result.query}: ${result.summary.substring(0, 150)}...\n`;
    });
  } else {
    summary += `No entities could be verified with web sources.\n`;
  }
  
  return summary;
}

function createSegmentsFromTranscript(transcript: string, wordTimings: Array<{ word: string; start: number; end: number; confidence: number }>): TextSegment[] {
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences.map((sentence, index) => ({
    id: `segment_${index}`,
    text: sentence.trim(),
    start: index * 5, // Mock timing
    end: (index + 1) * 5,
    metadata: {
      wordCount: sentence.trim().split(/\s+/).length,
      characterCount: sentence.trim().length,
      hasTimestamps: wordTimings.length > 0,
      marks: [],
      confidence: 0.8
    }
  }));
}

function extractProblematicEntities(nerResult: string): Array<{
  text: string;
  label: string;
  confidence: string;
  potentialIssues: string[];
  suggestions: string[];
}> {
  // Parse NER result and extract entities with issues
  try {
    const parsed = JSON.parse(nerResult);
    return (parsed.entities || []).filter((entity: any) => 
      entity.potentialIssues && entity.potentialIssues.length > 0
    );
  } catch {
    return [];
  }
}

function calculateNERUncertainty(entities: Array<{ confidence: string; potentialIssues: string[] }>): number {
  if (entities.length === 0) return 0;
  
  const avgConfidence = entities.reduce((sum, entity) => {
    const conf = entity.confidence === 'high' ? 0.9 : entity.confidence === 'medium' ? 0.6 : 0.3;
    return sum + conf;
  }, 0) / entities.length;
  
  const totalIssues = entities.reduce((sum, entity) => sum + entity.potentialIssues.length, 0);
  const issuesPenalty = Math.min(totalIssues * 0.1, 0.5);
  
  return Math.max(0, Math.min(1, 1 - avgConfidence + issuesPenalty));
}

function detectLowConfidenceSegments(transcript: string, wordTimings: Array<{ word: string; confidence: number }>, threshold: number): Array<any> {
  // Implementation for detecting low confidence segments
  return [];
}

function createWebSearchSegments(transcript: string, searchResults: Array<any>, verifiedEntities: string[]): Array<any> {
  // Implementation for creating web search segments
  return [];
}

async function detectSemanticIssues(transcript: string): Promise<Array<any>> {
  // Implementation for semantic issue detection
  return [];
}

async function categorizeSegment(segment: any, context: string): Promise<{
  action: 'web_search' | 'user_dialogue' | 'direct_correction';
  reason: string;
  priority: number;
}> {
  // Implementation for segment categorization using LLM
  return {
    action: 'user_dialogue',
    reason: 'Default categorization',
    priority: 2
  };
}

function getFallbackCategorization(segment: any): {
  action: 'web_search' | 'user_dialogue' | 'direct_correction';
  reason: string;
  priority: number;
} {
  return {
    action: 'user_dialogue',
    reason: 'Fallback categorization - requires manual review',
    priority: 2
  };
}

// Create the LangGraph agent
export function createASRAgent() {
  const workflow = new StateGraph<ASRAgentState>({
    channels: {
      audioFilePath: null,
      language: null,
      transcript: null,
      nBestList: null,
      confidenceScores: null,
      wordTimings: null,
      searchResults: null,
      contextualInfo: null,
      verifiedEntities: null,
      textSegments: null,
      nerSegments: null,
      segmentsOfInterest: null,
      processingSteps: null,
      totalSegments: null,
      segmentsWithIssues: null,
      processingTime: null,
      errors: null
    }
  });

  // Add nodes
  workflow.addNode("asr", asrNode);
  workflow.addNode("webSearch", webSearchNode);
  workflow.addNode("ner", nerNode);
  workflow.addNode("errorDetection", errorDetectionNode);
  workflow.addNode("categorization", categorizationNode);

  // Add edges - NER should run BEFORE web search to identify actual entities
  workflow.setEntryPoint("asr");
  workflow.addEdge("asr", "ner");
  workflow.addEdge("ner", "webSearch");
  workflow.addEdge("webSearch", "errorDetection");
  workflow.addEdge("errorDetection", "categorization");
  workflow.setFinishPoint("categorization");

  return workflow.compile();
}

// Main execution function
export async function processAudioWithLangGraph(
  audioFilePath: string, 
  language: string = 'et',
  realTranscript?: string,
  realWords?: Array<{ start: number; end: number; id: string; text?: string }>,
  realSpeakers?: Array<{ name: string; id: string; start: number; end: number }>
): Promise<{
  transcript: string;
  segmentsOfInterest: any[];
  processingSteps: string[];
  webSearchContext?: string;
  totalSegments: number;
  segmentsWithIssues: number;
  processingTime: number;
}> {
  console.log('🚀 LangGraphAgent: Starting audio processing...');
  const startTime = Date.now();

  const agent = createASRAgent();
  
  const initialState: ASRAgentState = {
    audioFilePath,
    language,
    transcript: realTranscript, // Pass real content if available
    wordTimings: realWords?.map(word => ({
      word: word.text || '',
      start: word.start,
      end: word.end,
      confidence: 0.8 // Default confidence for real content
    })),
    processingSteps: [],
    errors: []
  };

  try {
    const result = await agent.invoke(initialState);
    const processingTime = Date.now() - startTime;

    console.log(`✅ LangGraphAgent: Processing completed in ${processingTime}ms`);
    
    return {
      transcript: result.transcript || '',
      segmentsOfInterest: result.segmentsOfInterest || [],
      processingSteps: result.processingSteps || [],
      webSearchContext: result.contextualInfo,
      totalSegments: result.totalSegments || 0,
      segmentsWithIssues: result.segmentsWithIssues || 0,
      processingTime
    };

  } catch (error) {
    console.error('❌ LangGraphAgent: Processing failed:', error);
    throw error;
  }
} 