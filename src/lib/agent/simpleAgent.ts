// Simplified ASR Agent for Phase 2 implementation
// This version focuses on the core logic without complex LangChain dependencies
import OpenAI from 'openai';
import { AGENT_CONFIG, isOpenRouterAvailable } from './config';
import { parseJsonFromLLM } from './llmUtils';
import { NERTool } from './nerTool';
import { WebSearchTool } from './webSearchTool';
import type { TextSegment, ExtractionStrategy, ExtractionOptions } from '$lib/components/editor/api/segmentExtraction';

// Helper function to truncate long content for logging
function truncateForLogging(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '... [TRUNCATED]';
}

// Helper function to safely stringify objects for logging
function safeStringify(obj: any, maxLength: number = 1000): string {
  try {
    const str = JSON.stringify(obj, null, 2);
    return truncateForLogging(str, maxLength);
  } catch (error) {
    return '[UNABLE TO STRINGIFY]';
  }
}



// Initialize OpenAI client for OpenRouter (only if API key is available)
let openai: OpenAI | null = null;

if (isOpenRouterAvailable()) {
  openai = new OpenAI({
    baseURL: AGENT_CONFIG.openRouter.baseURL,
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: AGENT_CONFIG.openRouter.headers
  });
  console.log('🔧 SimpleAgent: OpenRouter client initialized with model:', AGENT_CONFIG.openRouter.model);
} else {
  console.warn('⚠️ SimpleAgent: OpenRouter API key not found. Agent will use rule-based fallbacks.');
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

// Web Search Analysis for contextual verification
class WebSearchAnalysis {
  private webSearchTool: WebSearchTool;
  private contextCache: Map<string, string> = new Map();

  constructor() {
    this.webSearchTool = new WebSearchTool();
  }

  /**
   * Perform contextual web search to gather background information about the transcript
   */
  async performContextualSearch(transcript: string, language: string = 'et'): Promise<{
    searchResults: Array<{
      query: string;
      verified: boolean;
      confidence: number;
      evidence: string[];
      summary: string;
    }>;
    contextualInfo: string;
    verifiedEntities: string[];
  }> {
    console.log(`🌐 Web Search: Starting contextual search for transcript (length: ${transcript.length} chars)`);
    
    const searchResults: Array<{
      query: string;
      verified: boolean;
      confidence: number;
      evidence: string[];
      summary: string;
    }> = [];
    
    try {
      // Extract key entities and phrases for search
      const searchQueries = this.generateSearchQueries(transcript);
      console.log(`🔍 Web Search: Generated ${searchQueries.length} search queries: ${searchQueries.join(', ')}`);

      // Perform searches in parallel (limit to avoid rate limiting)
      const maxParallelSearches = 3;
      for (let i = 0; i < searchQueries.length; i += maxParallelSearches) {
        const batch = searchQueries.slice(i, i + maxParallelSearches);
        console.log(`🌐 Web Search: Processing batch ${Math.floor(i / maxParallelSearches) + 1}: ${batch.join(', ')}`);
        
        const batchPromises = batch.map(async (query) => {
          try {
            const searchStartTime = Date.now();
            const context = await this.generateSearchContext(query, language);
            const searchInput = JSON.stringify({
              query,
              context,
              maxResults: 3
            });
            
            console.log(`➡️ Web Search Query: ${query}`);
            const result = await this.webSearchTool.call(searchInput);
            const searchDuration = Date.now() - searchStartTime;
            console.log(`⬅️ Web Search Result (${searchDuration}ms): ${truncateForLogging(result, 300)}`);
            
            // Parse the result to extract verification info
            const verified = result.includes('✅') && !result.includes('❌');
            const confidenceMatch = result.match(/Entity verification: (\d+)\/(\d+) entities verified/);
            const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / parseInt(confidenceMatch[2]) : 0.5;
            
            // Extract evidence and summary
            const evidence = this.extractEvidence(result);
            const summary = this.extractSummary(result);
            
            return {
              query,
              verified,
              confidence,
              evidence,
              summary
            };
          } catch (error) {
            console.error(`❌ Web Search: Error searching for "${query}":`, error);
            return {
              query,
              verified: false,
              confidence: 0,
              evidence: [],
              summary: `Search failed: ${error.message}`
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        searchResults.push(...batchResults);
        
        // Add delay between batches to avoid rate limiting
        if (i + maxParallelSearches < searchQueries.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Generate contextual information summary
      const verifiedQueries = searchResults.filter(r => r.verified).map(r => r.query);
      const contextualInfo = this.generateContextualSummary(searchResults);
      
      console.log(`✅ Web Search: Completed contextual search with ${searchResults.length} results`);
      console.log(`📊 Web Search Summary: ${verifiedQueries.length}/${searchResults.length} queries verified`);
      
      return {
        searchResults,
        contextualInfo,
        verifiedEntities: verifiedQueries
      };

    } catch (error) {
      console.error('❌ Web Search: Error in contextual search:', error);
      return {
        searchResults: [],
        contextualInfo: `Web search failed: ${error.message}`,
        verifiedEntities: []
      };
    }
  }

  /**
   * Generate intelligent search context for a query using LLM
   */
  private async generateSearchContext(query: string, language: string): Promise<string> {
    // Skip LLM call for very short queries or if no LLM available
    if (query.length < 3 || !openai) {
      console.log(`🔍 WebSearchAnalysis: No context for short query or no LLM: "${query}"`);
      return '';
    }

    // Check cache first
    const cacheKey = `${query.toLowerCase()}_${language}`;
    if (this.contextCache.has(cacheKey)) {
      const cachedContext = this.contextCache.get(cacheKey)!;
      console.log(`💾 WebSearchAnalysis: Using cached context for "${query}": "${cachedContext}"`);
      return cachedContext;
    }

    try {
      console.log(`🧠 WebSearchAnalysis: Using LLM to determine context for: "${query}"`);
      
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
           { 
             role: 'system', 
             content: 'You are an expert at optimizing web search queries. Respond only with valid JSON.' 
           },
           { 
             role: 'user', 
             content: prompt 
           }
         ],
         temperature: 0.1,
         max_tokens: 150
       });

             const content = response.choices[0]?.message?.content;
       if (content) {
         const result = parseJsonFromLLM(content);
         const context = result.needsContext ? (result.suggestedContext || '') : '';
         
         // Cache the result
         this.contextCache.set(cacheKey, context);
         
         console.log(`🎯 LLM Context Decision for "${query}": ${result.needsContext ? `"${context}"` : 'no context'} - ${result.reasoning}`);
         return context;
       }

         } catch (error) {
       console.error(`❌ WebSearchAnalysis: LLM context generation failed for "${query}":`, error.message);
     }

     // Fallback to no context if LLM fails and cache the fallback
     const fallbackContext = '';
     this.contextCache.set(cacheKey, fallbackContext);
     console.log(`🔍 WebSearchAnalysis: Fallback - no context for: "${query}"`);
     return fallbackContext;
  }

  /**
   * Generate search queries from transcript
   */
  private generateSearchQueries(transcript: string): string[] {
    console.log(`🔍 WebSearchAnalysis: Generating search queries from transcript (${transcript.length} chars)`);
    console.log(`📝 Transcript excerpt: "${transcript.substring(0, 200)}..."`);
    
    const queries: string[] = [];
    
    // Extract named entities (capitalized words/phrases)
    const entityRegex = /\b[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+(?:\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+)*\b/g;
    const entities = transcript.match(entityRegex) || [];
    console.log(`🏷️ WebSearchAnalysis: Found ${entities.length} potential entities: ${entities.join(', ')}`);
    
    // Add unique entities as search queries
    const uniqueEntities = [...new Set(entities)].filter(entity => 
      entity.length > 3 && 
      !['Eesti', 'Estonia', 'Estonian'].includes(entity) // Exclude very common terms
    );
    console.log(`✅ WebSearchAnalysis: Filtered to ${uniqueEntities.length} unique entities: ${uniqueEntities.join(', ')}`);
    
    queries.push(...uniqueEntities.slice(0, 5)); // Limit to top 5 entities
    
    // Extract potential organizations/institutions
    const orgRegex = /\b([A-ZÄÖÜÕŠŽ][a-zäöüõšž]+\s+)?(?:Ülikool|University|Akadeemia|Academy|Instituut|Institute|Ettevõte|Company)\b/g;
    const orgs = transcript.match(orgRegex) || [];
    if (orgs.length > 0) {
      console.log(`🏛️ WebSearchAnalysis: Found ${orgs.length} organizations: ${orgs.join(', ')}`);
      queries.push(...orgs.slice(0, 2));
    }
    
    // Extract potential titles/positions
    const titleRegex = /\b(?:rektor|professor|direktor|minister|president|juhataja)\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+/gi;
    const titles = transcript.match(titleRegex) || [];
    if (titles.length > 0) {
      console.log(`👨‍💼 WebSearchAnalysis: Found ${titles.length} titles/positions: ${titles.join(', ')}`);
      queries.push(...titles.slice(0, 2));
    }
    
    const finalQueries = [...new Set(queries)].slice(0, 8); // Limit total queries and remove duplicates
    console.log(`📋 WebSearchAnalysis: Final search queries (${finalQueries.length}): ${finalQueries.join(', ')}`);
    
    return finalQueries;
  }

  /**
   * Extract evidence from search result
   */
  private extractEvidence(result: string): string[] {
    const evidence: string[] = [];
    
    // Extract snippets from search results
    const snippetRegex = /📝 ([^🔗]+)/g;
    let match;
    while ((match = snippetRegex.exec(result)) !== null) {
      if (match[1] && match[1].trim()) {
        evidence.push(match[1].trim().substring(0, 200));
      }
    }
    
    // Extract evidence lines
    const evidenceRegex = /Evidence: ([^\.]+)/g;
    while ((match = evidenceRegex.exec(result)) !== null) {
      if (match[1] && match[1].trim()) {
        evidence.push(match[1].trim());
      }
    }
    
    return evidence.slice(0, 3); // Limit to top 3 pieces of evidence
  }

  /**
   * Extract summary from search result
   */
  private extractSummary(result: string): string {
    const consensusMatch = result.match(/Consensus: ([^\\n]+)/);
    if (consensusMatch && consensusMatch[1]) {
      return consensusMatch[1].trim().substring(0, 300);
    }
    
    // Fallback to first search result snippet
    const snippetMatch = result.match(/📝 ([^🔗]+)/);
    if (snippetMatch && snippetMatch[1]) {
      return snippetMatch[1].trim().substring(0, 200) + '...';
    }
    
    return 'No summary available';
  }

  /**
   * Generate contextual summary from all search results
   */
  private generateContextualSummary(searchResults: Array<{
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
    console.log(`🔍 NER Analysis: Starting analysis of ${segments.length} segments (language: ${language})`);
    const segmentsOfInterest: SegmentOfInterest[] = [];

    for (const segment of segments) {
      try {
        console.log(`📝 NER Analysis: Processing segment "${truncateForLogging(segment.text, 100)}"`);
        
        // Use NER tool to analyze the segment
        const nerInput = JSON.stringify({
          text: segment.text,
          language
        });
        console.log(`➡️ NER Tool Input: ${nerInput}`);
        
        const nerResult = await this.nerTool.call(nerInput);
        console.log(`⬅️ NER Tool Output: ${truncateForLogging(nerResult, 800)}`);

        // Parse NER result to find problematic entities
        const problematicEntities = this.extractProblematicEntities(nerResult);
        
        if (problematicEntities.length > 0) {
          console.log(`⚠️ NER Analysis: Found ${problematicEntities.length} problematic entities in segment`);
          console.log(`🔍 Problematic entities: ${safeStringify(problematicEntities, 600)}`);
          
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
        } else {
          console.log(`✅ NER Analysis: No issues found in segment`);
        }
      } catch (error) {
        console.error(`❌ NER Analysis: Error analyzing segment ${segment.id}:`, error);
      }
    }

    console.log(`🎯 NER Analysis: Completed analysis, found ${segmentsOfInterest.length} segments with NER issues`);
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
  private webSearchAnalysis: WebSearchAnalysis;

  constructor() {
    this.nerAnalysis = new SegmentNERAnalysis();
    this.webSearchAnalysis = new WebSearchAnalysis();
  }

  async detectErrors(asrOutput: ASROutput, webSearchContext?: {
    searchResults: Array<{
      query: string;
      verified: boolean;
      confidence: number;
      evidence: string[];
      summary: string;
    }>;
    contextualInfo: string;
    verifiedEntities: string[];
  }): Promise<SegmentOfInterest[]> {
    console.log(`🔍 Error Detection: Starting error detection on transcript (${asrOutput.transcript.length} chars, ${asrOutput.wordTimings.length} words)`);
    const segments: SegmentOfInterest[] = [];
    
    // First, analyze with web search context if available
    if (webSearchContext) {
      console.log(`🌐 Error Detection: Analyzing with web search context (${webSearchContext.verifiedEntities.length} verified entities)`);
      const webSearchSegments = await this.analyzeWithWebSearchContext(asrOutput, webSearchContext);
      segments.push(...webSearchSegments);
      console.log(`✅ Error Detection: Web search analysis added ${webSearchSegments.length} segments`);
    }

    // Second, detect low confidence words (rule-based)
    console.log(`📊 Error Detection: Checking for low confidence words (threshold: ${AGENT_CONFIG.thresholds.lowConfidence})`);
    let lowConfidenceCount = 0;
    asrOutput.wordTimings.forEach((word, index) => {
      if (word.confidence < AGENT_CONFIG.thresholds.lowConfidence) {
        lowConfidenceCount++;
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
    console.log(`🔍 Error Detection: Found ${lowConfidenceCount} low confidence words`);

    // Detect N-best variance (rule-based)
    console.log(`📊 Error Detection: Checking N-best variance (${asrOutput.nBestList.length} alternatives)`);
    let nbestVarianceCount = 0;
    if (asrOutput.nBestList.length > 1) {
      const words1 = asrOutput.nBestList[0].split(' ');
      const words2 = asrOutput.nBestList[1].split(' ');
      
      for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
        if (words1[i] !== words2[i]) {
          nbestVarianceCount++;
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
    console.log(`🔍 Error Detection: Found ${nbestVarianceCount} N-best variance issues`);

    // Use NER analysis on segments
    try {
      console.log(`🧬 Error Detection: Starting NER analysis phase`);
      const textSegments = this.nerAnalysis.createSegmentsFromASR(asrOutput);
      const nerSegments = await this.nerAnalysis.analyzeSegmentsWithNER(textSegments, 'et');
      segments.push(...nerSegments);
      console.log(`✅ Error Detection: NER analysis completed, added ${nerSegments.length} NER-related segments`);
    } catch (error) {
      console.error('❌ Error Detection: Error in NER analysis:', error);
    }

    // Use LLM for semantic analysis
    try {
      console.log(`🧠 Error Detection: Starting semantic analysis phase`);
      const semanticSegments = await this.detectSemanticIssues(asrOutput.transcript);
      segments.push(...semanticSegments);
      console.log(`✅ Error Detection: Semantic analysis completed, added ${semanticSegments.length} semantic segments`);
    } catch (error) {
      console.error('❌ Error Detection: Error in semantic analysis:', error);
    }

    console.log(`🎯 Error Detection: Completed with ${segments.length} total segments of interest`);
    console.log(`📊 Breakdown: ${lowConfidenceCount} low conf, ${nbestVarianceCount} N-best var, ${segments.filter(s => s.reason === 'ner_issue').length} NER, ${segments.filter(s => s.reason === 'semantic_anomaly').length} semantic`);

    return segments;
  }

  /**
   * Analyze transcript against web search context to identify potential issues
   */
  private async analyzeWithWebSearchContext(asrOutput: ASROutput, webSearchContext: {
    searchResults: Array<{
      query: string;
      verified: boolean;
      confidence: number;
      evidence: string[];
      summary: string;
    }>;
    contextualInfo: string;
    verifiedEntities: string[];
  }): Promise<SegmentOfInterest[]> {
    const segments: SegmentOfInterest[] = [];
    
    try {
      // Find entities in transcript that were NOT verified by web search
      const transcript = asrOutput.transcript;
      const entityRegex = /\b[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+(?:\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+)*\b/g;
      const entities = transcript.match(entityRegex) || [];
      
      for (const entity of entities) {
        // Check if this entity was verified
        const wasVerified = webSearchContext.verifiedEntities.includes(entity);
        const searchResult = webSearchContext.searchResults.find(r => r.query === entity);
        
        if (!wasVerified && entity.length > 3) {
          // Entity was not verified - flag as potentially problematic
          const entityStart = transcript.indexOf(entity);
          const entityEnd = entityStart + entity.length;
          
          segments.push({
            id: `web_unverified_${entity.replace(/\s/g, '_')}`,
            text: entity,
            start: entityStart,
            end: entityEnd,
            reason: 'web_search_verified',
            uncertaintyScore: 0.7,
            action: 'web_search',
            priority: 4,
            categorizationReason: 'Entity not verified by web search',
            webSearchResults: searchResult ? {
              query: searchResult.query,
              verified: searchResult.verified,
              confidence: searchResult.confidence,
              evidence: searchResult.evidence,
              summary: searchResult.summary
            } : undefined
          });
        } else if (wasVerified && searchResult) {
          // Entity was verified - add as positive signal but lower priority
          const entityStart = transcript.indexOf(entity);
          const entityEnd = entityStart + entity.length;
          
          segments.push({
            id: `web_verified_${entity.replace(/\s/g, '_')}`,
            text: entity,
            start: entityStart,
            end: entityEnd,
            reason: 'web_search_verified',
            uncertaintyScore: 1 - searchResult.confidence,
            action: 'direct_correction',
            priority: 1,
            categorizationReason: 'Entity verified by web search',
            webSearchResults: {
              query: searchResult.query,
              verified: searchResult.verified,
              confidence: searchResult.confidence,
              evidence: searchResult.evidence,
              summary: searchResult.summary
            }
          });
        }
      }
      
      console.log(`🌐 Web Search Analysis: Processed ${entities.length} entities, flagged ${segments.filter(s => !s.webSearchResults?.verified).length} unverified`);
      
    } catch (error) {
      console.error('❌ Web Search Analysis: Error analyzing with web search context:', error);
    }
    
    return segments;
  }

  private async detectSemanticIssues(transcript: string): Promise<SegmentOfInterest[]> {
    // If OpenRouter is not available, return empty array
    if (!openai) {
      console.log('⚠️ Semantic Analysis: OpenRouter not available, skipping semantic analysis');
      return [];
    }

    console.log(`🧠 Semantic Analysis: Starting analysis of transcript (length: ${transcript.length} chars)`);
    console.log(`📝 Transcript preview: "${truncateForLogging(transcript, 200)}"`);

    try {
      const messages = [
        {
          role: 'system' as const,
          content: `You are an expert at analyzing ASR transcripts for potential errors. 
          Identify segments that may have semantic anomalies, awkward phrasing, or potential factual inaccuracies.
          Return only a JSON array of problematic segments.`
        },
        {
          role: 'user' as const,
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
      ];

      console.log(`➡️ LLM Prompt (Semantic Analysis):`);
      console.log(`   Model: ${AGENT_CONFIG.openRouter.model}`);
      console.log(`   System: ${truncateForLogging(messages[0].content, 300)}`);
      console.log(`   User: ${truncateForLogging(messages[1].content, 400)}`);

      const response = await openai.chat.completions.create({
        model: AGENT_CONFIG.openRouter.model,
        messages,
        temperature: AGENT_CONFIG.openRouter.temperature,
        max_tokens: AGENT_CONFIG.openRouter.maxTokens
      });

      const content = response.choices[0]?.message?.content;
      console.log(`⬅️ LLM Response (Semantic Analysis): ${truncateForLogging(content || '[NO CONTENT]', 600)}`);
      console.log(`📊 Usage: tokens=${response.usage?.total_tokens || 'unknown'}, model=${response.model || 'unknown'}`);

      if (content) {
        try {
          const semanticIssues = parseJsonFromLLM(content);
          console.log(`✅ Semantic Analysis: Successfully parsed ${semanticIssues.length} semantic issues`);
          
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
          console.error('❌ Semantic Analysis: Failed to parse semantic analysis result:', parseError);
          console.error('Raw content that failed to parse:', truncateForLogging(content, 1000));
          return [];
        }
      }
    } catch (error) {
      console.error('❌ Semantic Analysis: Error calling OpenRouter for semantic analysis:', error);
    }

    console.log('🎯 Semantic Analysis: Completed with no results');
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
      console.log('⚠️ SOI Categorization: OpenRouter not available, using fallback categorization');
      return this.getFallbackCategorization(segment);
    }

    console.log(`🎯 SOI Categorization: Starting categorization for segment "${truncateForLogging(segment.text, 100)}"`);
    console.log(`📊 Segment details: reason=${segment.reason}, uncertainty=${segment.uncertaintyScore}`);

    try {
      const messages = [
        {
          role: 'system' as const,
          content: `You are an expert at categorizing segments of interest in ASR transcripts. 
          Analyze each segment and decide the best approach for correction.`
        },
        {
          role: 'user' as const,
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
      ];

      console.log(`➡️ LLM Prompt (SOI Categorization):`);
      console.log(`   Model: ${AGENT_CONFIG.openRouter.model}`);
      console.log(`   System: ${truncateForLogging(messages[0].content, 300)}`);
      console.log(`   User: ${truncateForLogging(messages[1].content, 500)}`);

      const response = await openai.chat.completions.create({
        model: AGENT_CONFIG.openRouter.model,
        messages,
        temperature: AGENT_CONFIG.openRouter.temperature,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      console.log(`⬅️ LLM Response (SOI Categorization): ${truncateForLogging(content || '[NO CONTENT]', 400)}`);
      console.log(`📊 Usage: tokens=${response.usage?.total_tokens || 'unknown'}, model=${response.model || 'unknown'}`);

      if (content) {
        try {
          const result = parseJsonFromLLM(content);
          console.log(`✅ SOI Categorization: Successfully parsed categorization - action: ${result.action}, priority: ${result.priority}`);
          return result;
        } catch (parseError) {
          console.error('❌ SOI Categorization: Failed to parse categorization result:', parseError);
          console.error('Raw content that failed to parse:', truncateForLogging(content, 1000));
          return this.getFallbackCategorization(segment);
        }
      }
    } catch (error) {
      console.error('❌ SOI Categorization: Error calling OpenRouter for categorization:', error);
    }

    console.log('🎯 SOI Categorization: Using fallback categorization');
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
  private webSearchAnalysis: WebSearchAnalysis;

  constructor() {
    this.errorDetection = new LLMErrorDetection();
    this.augmentationController = new LLMAugmentationController();
    this.asrTool = new MockASRTool();
    this.webSearchAnalysis = new WebSearchAnalysis();
  }

  async processAudio(audioFilePath: string): Promise<{
    transcript: string;
    segmentsOfInterest: SegmentOfInterest[];
    processingSteps: string[];
    webSearchContext?: string;
  }> {
    const startTime = Date.now();
    console.log(`🚀 SimpleASRAgent: Starting audio processing for file: ${audioFilePath}`);
    const processingSteps: string[] = [];
    
    try {
      // Step 1: ASR Transcription
      console.log(`🎙️ SimpleASRAgent: Step 1 - Starting ASR transcription`);
      processingSteps.push('Starting ASR transcription...');
      const asrStartTime = Date.now();
      
      const asrOutput = await this.asrTool.transcribe(audioFilePath);
      const asrDuration = Date.now() - asrStartTime;
      
      console.log(`✅ SimpleASRAgent: ASR completed in ${asrDuration}ms`);
      console.log(`📝 ASR Results: transcript=${asrOutput.transcript.length} chars, ${asrOutput.wordTimings.length} words, ${asrOutput.nBestList.length} alternatives`);
      console.log(`📄 Transcript preview: "${truncateForLogging(asrOutput.transcript, 300)}"`);
      processingSteps.push(`ASR transcription completed in ${asrDuration}ms`);

      // Step 2: Web Search Contextual Analysis (NEW FIRST STEP)
      console.log(`🌐 SimpleASRAgent: Step 2 - Starting web search contextual analysis`);
      processingSteps.push('Performing web search for contextual verification...');
      const webSearchStartTime = Date.now();
      
      const webSearchContext = await this.webSearchAnalysis.performContextualSearch(asrOutput.transcript, 'et');
      const webSearchDuration = Date.now() - webSearchStartTime;
      
      console.log(`✅ SimpleASRAgent: Web search analysis completed in ${webSearchDuration}ms`);
      console.log(`🌐 Web Search Results: ${webSearchContext.searchResults.length} searches, ${webSearchContext.verifiedEntities.length} verified entities`);
      processingSteps.push(`Web search completed: ${webSearchContext.verifiedEntities.length}/${webSearchContext.searchResults.length} entities verified in ${webSearchDuration}ms`);

      // Step 3: Error Detection (Enhanced with Web Search Context)
      console.log(`🔍 SimpleASRAgent: Step 3 - Starting error detection with web search context`);
      processingSteps.push('Analyzing transcript for potential errors with web search context...');
      const errorDetectionStartTime = Date.now();
      
      const segmentsOfInterest = await this.errorDetection.detectErrors(asrOutput, webSearchContext);
      const errorDetectionDuration = Date.now() - errorDetectionStartTime;
      
      console.log(`✅ SimpleASRAgent: Error detection completed in ${errorDetectionDuration}ms`);
      console.log(`🎯 Found ${segmentsOfInterest.length} segments of interest`);
      processingSteps.push(`Found ${segmentsOfInterest.length} segments of interest in ${errorDetectionDuration}ms`);

      // Step 4: Categorize and prioritize SOIs
      console.log(`🏷️ SimpleASRAgent: Step 4 - Starting SOI categorization (${segmentsOfInterest.length} segments)`);
      processingSteps.push('Categorizing segments for processing...');
      const categorizationStartTime = Date.now();
      const categorizedSOIs: SegmentOfInterest[] = [];
      
      for (let i = 0; i < segmentsOfInterest.length; i++) {
        const segment = segmentsOfInterest[i];
        console.log(`🏷️ SimpleASRAgent: Categorizing segment ${i + 1}/${segmentsOfInterest.length}: "${truncateForLogging(segment.text, 80)}"`);
        
        const segmentCategorizationStart = Date.now();
        const categorization = await this.augmentationController.categorizeSOI(
          segment,
          asrOutput.transcript
        );
        const segmentCategorizationDuration = Date.now() - segmentCategorizationStart;
        
        console.log(`✅ SimpleASRAgent: Segment categorized in ${segmentCategorizationDuration}ms - action: ${categorization.action}, priority: ${categorization.priority}`);
        
        categorizedSOIs.push({
          ...segment,
          action: categorization.action,
          priority: categorization.priority,
          categorizationReason: categorization.reason
        });
      }

      const categorizationDuration = Date.now() - categorizationStartTime;
      console.log(`✅ SimpleASRAgent: All segments categorized in ${categorizationDuration}ms`);

      // Sort by priority
      console.log(`📊 SimpleASRAgent: Sorting segments by priority`);
      categorizedSOIs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      // Log final results
      const totalDuration = Date.now() - startTime;
      console.log(`🎉 SimpleASRAgent: Processing completed successfully in ${totalDuration}ms`);
      console.log(`📊 Final Results Summary:`);
      console.log(`   - Transcript: ${asrOutput.transcript.length} characters`);
      console.log(`   - Segments of Interest: ${categorizedSOIs.length}`);
      console.log(`   - Timing: ASR ${asrDuration}ms, Web Search ${webSearchDuration}ms, Error Detection ${errorDetectionDuration}ms, Categorization ${categorizationDuration}ms`);
      
      const actionCounts = {
        web_search: categorizedSOIs.filter(s => s.action === 'web_search').length,
        user_dialogue: categorizedSOIs.filter(s => s.action === 'user_dialogue').length,
        direct_correction: categorizedSOIs.filter(s => s.action === 'direct_correction').length
      };
      console.log(`   - Actions: ${actionCounts.web_search} web_search, ${actionCounts.user_dialogue} user_dialogue, ${actionCounts.direct_correction} direct_correction`);
      console.log(`   - Web Search: ${webSearchContext.verifiedEntities.length} verified entities, ${webSearchContext.searchResults.length} total searches`);

      return {
        transcript: asrOutput.transcript,
        segmentsOfInterest: categorizedSOIs,
        processingSteps,
        webSearchContext: webSearchContext.contextualInfo
      };

    } catch (error) {
      const errorDuration = Date.now() - startTime;
      console.error(`❌ SimpleASRAgent: Error in processing after ${errorDuration}ms:`, error);
      processingSteps.push(`Error: ${error.message}`);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    console.log('🔧 SimpleASRAgent: Initializing Simple ASR Agent with Web Search...');
    console.log(`🔧 Configuration: OpenRouter available: ${isOpenRouterAvailable()}`);
    console.log(`🔧 Thresholds: lowConf=${AGENT_CONFIG.thresholds.lowConfidence}, modUnc=${AGENT_CONFIG.thresholds.moderateUncertainty}, highUnc=${AGENT_CONFIG.thresholds.highUncertainty}`);
    console.log(`🌐 Web Search: Integrated as first analysis step for contextual verification`);
    console.log(`🔄 Processing Pipeline: ASR → Web Search → Error Detection → Categorization`);
    // Add any initialization logic here
    console.log('✅ SimpleASRAgent: Initialization completed');
  }
}

// Singleton instance
let agentInstance: SimpleASRAgent | null = null;

export async function getSimpleASRAgent(): Promise<SimpleASRAgent> {
  if (!agentInstance) {
    console.log('🏗️ SimpleASRAgent: Creating new agent instance (singleton)');
    agentInstance = new SimpleASRAgent();
    await agentInstance.initialize();
  } else {
    console.log('♻️ SimpleASRAgent: Returning existing agent instance');
  }
  return agentInstance;
} 