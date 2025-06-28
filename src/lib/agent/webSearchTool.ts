import { Tool } from '@langchain/core/tools';
import axios from 'axios';

/**
 * LangChain Tool for Web Search
 * This tool can be used by the AI agent to search for contextual information
 * to verify facts, entities, and claims in ASR transcripts.
 */

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  rank: number;
  relevanceScore?: number;
  source: string;
  extractedInfo?: {
    facts: string[];
    entities: string[];
    dates: string[];
    numbers: string[];
  };
}

interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  totalResults?: number;
  searchTime?: number;
  summary?: {
    topResult: SearchResult | null;
    factualClaims: string[];
    entityVerifications: Array<{
      entity: string;
      verified: boolean;
      confidence: number;
      evidence: string;
    }>;
    consensus?: string;
    contradictions?: string[];
  };
  searchProvider: string;
}

export class WebSearchTool extends Tool {
  name = 'web_search';
  description = `
    Search the web for factual information and context to verify ASR transcript content.
    Use this tool when you need to:
    - Verify facts, claims, or statements mentioned in transcripts
    - Check spelling and context of proper nouns, organizations, locations
    - Find background information about entities mentioned in audio
    - Resolve ambiguities between N-best ASR hypotheses
    - Get current or factual information about events, people, or topics
    
    Input should be a JSON string with 'query' (required), 'context' (optional), and 'maxResults' (optional, defaults to 5).
    Example: {"query": "Tallinna Ülikooli rektor Tiit Land", "context": "Estonian university rector", "maxResults": 3}
  `;

  private searchProvider: 'serpapi' | 'google' | 'bing' | 'duckduckgo';
  private apiKey?: string;
  private searchEngineId?: string;

  constructor(options: {
    searchProvider?: 'serpapi' | 'google' | 'bing' | 'duckduckgo';
    apiKey?: string;
    searchEngineId?: string;
  } = {}) {
    super();
    
    // Auto-detect the best available provider if not specified
    if (options.searchProvider) {
      this.searchProvider = options.searchProvider;
    } else {
      // Check which providers have API keys configured
      const serpApiKey = process.env.SERPAPI_API_KEY;
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const googleEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
      const bingApiKey = process.env.BING_SEARCH_API_KEY;
      
      if (serpApiKey) {
        this.searchProvider = 'serpapi';
        console.log('🔧 WebSearchTool: Using SerpAPI provider');
      } else if (googleApiKey && googleEngineId) {
        this.searchProvider = 'google';
        console.log('🔧 WebSearchTool: Using Google Custom Search provider');
      } else if (bingApiKey) {
        this.searchProvider = 'bing';
        console.log('🔧 WebSearchTool: Using Bing Search provider');
      } else {
        this.searchProvider = 'duckduckgo';
        console.log('🔧 WebSearchTool: No API keys found, using DuckDuckGo provider (free)');
      }
    }
    
    this.apiKey = options.apiKey || process.env.SERPAPI_API_KEY || process.env.GOOGLE_SEARCH_API_KEY || process.env.BING_SEARCH_API_KEY;
    this.searchEngineId = options.searchEngineId || process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  protected async _call(input: string): Promise<string> {
    const callStartTime = Date.now();
    let query = 'unknown';
    
    try {
      // Parse input
      const parsedInput = JSON.parse(input);
      const { query: inputQuery, context, maxResults = 5 } = parsedInput;
      query = inputQuery;

      console.log(`🔍 WebSearchTool: Starting search for "${query}" ${context ? `with context "${context}"` : '(no context)'}`);

      if (!query || typeof query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
      }

      // Enhance query with context if provided
      const enhancedQuery = context ? `${query} ${context}` : query;
      console.log(`🌐 WebSearchTool: Enhanced query: "${enhancedQuery}" (max results: ${maxResults})`);

      // Perform web search
      console.log(`🔎 WebSearchTool: Performing search with ${this.searchProvider} provider...`);
      const searchStartTime = Date.now();
      const searchResults = await this.performSearch(enhancedQuery, maxResults);
      const searchDuration = Date.now() - searchStartTime;
      
      console.log(`✅ WebSearchTool: Search completed in ${searchDuration}ms, found ${searchResults.length} results`);
      searchResults.forEach((result, index) => {
        console.log(`   ${index + 1}. "${result.title}" - ${result.source}`);
        console.log(`      ${result.snippet.substring(0, 150)}...`);
      });

      // Process and analyze results
      console.log(`🧠 WebSearchTool: Processing and analyzing search results...`);
      const processingStartTime = Date.now();
      const processedResults = await this.processSearchResults(searchResults, query, context);
      const processingDuration = Date.now() - processingStartTime;
      
      console.log(`✅ WebSearchTool: Processing completed in ${processingDuration}ms`);
      if (processedResults.summary) {
        console.log(`📊 WebSearchTool: Analysis summary:`);
        console.log(`   - Entity verifications: ${processedResults.summary.entityVerifications.length}`);
        console.log(`   - Verified entities: ${processedResults.summary.entityVerifications.filter(e => e.verified).length}`);
        console.log(`   - Factual claims: ${processedResults.summary.factualClaims.length}`);
        if (processedResults.summary.contradictions && processedResults.summary.contradictions.length > 0) {
          console.log(`   - ⚠️ Contradictions found: ${processedResults.summary.contradictions.length}`);
        }
      }

      // Format response for the agent
      const response = this.formatResponse(processedResults);
      const totalDuration = Date.now() - callStartTime;
      
      console.log(`🎯 WebSearchTool: Search for "${query}" completed in ${totalDuration}ms total`);
      
      return response;

    } catch (error) {
      const errorDuration = Date.now() - callStartTime;
      console.error(`❌ WebSearchTool: Search for "${query}" failed after ${errorDuration}ms:`, error);
      
      if (axios.isAxiosError(error)) {
        throw new Error(`Web search API error: ${error.response?.data?.error || error.message}`);
      }
      throw new Error(`Web search tool error: ${error.message}`);
    }
  }

  private async performSearch(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      switch (this.searchProvider) {
        case 'serpapi':
          return await this.searchWithSerpAPI(query, maxResults);
        case 'google':
          return await this.searchWithGoogle(query, maxResults);
        case 'bing':
          return await this.searchWithBing(query, maxResults);
        case 'duckduckgo':
          return await this.searchWithDuckDuckGo(query, maxResults);
        default:
          throw new Error(`Unsupported search provider: ${this.searchProvider}`);
      }
    } catch (error) {
      // If the primary provider fails due to missing API keys, fall back to DuckDuckGo
      if (this.searchProvider !== 'duckduckgo' && 
          (error.message.includes('key not configured') || 
           error.message.includes('API key') || 
           error.message.includes('not configured'))) {
        console.log(`⚠️ WebSearchTool: ${this.searchProvider} failed due to missing API key, falling back to DuckDuckGo`);
        return await this.searchWithDuckDuckGo(query, maxResults);
      }
      throw error;
    }
  }

  private async searchWithSerpAPI(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('SerpAPI key not configured. Set SERPAPI_API_KEY environment variable.');
    }

    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: query,
        api_key: this.apiKey,
        engine: 'google',
        num: maxResults,
        gl: 'ee', // Estonia geolocation for Estonian content preference
        hl: 'et'   // Estonian language preference
      },
      timeout: 15000
    });

    const results = response.data.organic_results || [];
    return results.map((result: any, index: number) => ({
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      displayLink: result.displayed_link,
      rank: index + 1,
      source: 'SerpAPI/Google',
      extractedInfo: this.extractInfoFromSnippet(result.snippet || '')
    }));
  }

  private async searchWithGoogle(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.apiKey || !this.searchEngineId) {
      throw new Error('Google Search API key or Search Engine ID not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables.');
    }

    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: this.apiKey,
        cx: this.searchEngineId,
        q: query,
        num: Math.min(maxResults, 10),
        gl: 'ee',
        hl: 'et'
      },
      timeout: 15000
    });

    const results = response.data.items || [];
    return results.map((result: any, index: number) => ({
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
      displayLink: result.displayLink,
      rank: index + 1,
      source: 'Google Custom Search',
      extractedInfo: this.extractInfoFromSnippet(result.snippet || '')
    }));
  }

  private async searchWithBing(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Bing Search API key not configured. Set BING_SEARCH_API_KEY environment variable.');
    }

    const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey
      },
      params: {
        q: query,
        count: maxResults,
        mkt: 'et-EE',
        responseFilter: 'Webpages'
      },
      timeout: 15000
    });

    const results = response.data.webPages?.value || [];
    return results.map((result: any, index: number) => ({
      title: result.name || '',
      link: result.url || '',
      snippet: result.snippet || '',
      displayLink: result.displayUrl,
      rank: index + 1,
      source: 'Bing Search',
      extractedInfo: this.extractInfoFromSnippet(result.snippet || '')
    }));
  }

  private async searchWithDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    console.log(`🦆 WebSearchTool: Using DuckDuckGo search for "${query}"`);
    
    try {
      // DuckDuckGo Instant Answer API (limited but free)
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 10000
      });

      const data = response.data;
      const results: SearchResult[] = [];
      
      console.log(`🦆 DuckDuckGo response keys: ${Object.keys(data).join(', ')}`);

      // Add abstract if available
      if (data.Abstract && data.Abstract.trim()) {
        console.log(`📖 DuckDuckGo: Found abstract for "${query}"`);
        results.push({
          title: data.Heading || `Information about ${query}`,
          link: data.AbstractURL || '',
          snippet: data.Abstract,
          rank: 1,
          source: 'DuckDuckGo Abstract',
          extractedInfo: this.extractInfoFromSnippet(data.Abstract)
        });
      }

      // Add definition if available
      if (data.Definition && data.Definition.trim()) {
        console.log(`📚 DuckDuckGo: Found definition for "${query}"`);
        results.push({
          title: `Definition: ${query}`,
          link: data.DefinitionURL || '',
          snippet: data.Definition,
          rank: results.length + 1,
          source: 'DuckDuckGo Definition',
          extractedInfo: this.extractInfoFromSnippet(data.Definition)
        });
      }

      // Add related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        console.log(`🔗 DuckDuckGo: Found ${data.RelatedTopics.length} related topics`);
        
        let topicsAdded = 0;
        for (const topic of data.RelatedTopics) {
          if (topicsAdded >= maxResults - results.length) break;
          
          if (topic.Text && topic.FirstURL) {
            const title = topic.Text.split(' - ')[0] || topic.Text.substring(0, 100);
            results.push({
              title: title,
              link: topic.FirstURL,
              snippet: topic.Text,
              rank: results.length + 1,
              source: 'DuckDuckGo Related',
              extractedInfo: this.extractInfoFromSnippet(topic.Text)
            });
            topicsAdded++;
          }
        }
      }

      // Add answer if available (for factual queries)
      if (data.Answer && data.Answer.trim()) {
        console.log(`💡 DuckDuckGo: Found direct answer for "${query}"`);
        results.push({
          title: `Answer: ${query}`,
          link: data.AnswerURL || '',
          snippet: data.Answer,
          rank: results.length + 1,
          source: 'DuckDuckGo Answer',
          extractedInfo: this.extractInfoFromSnippet(data.Answer)
        });
      }

      // If no results, create a basic informational result
      if (results.length === 0) {
        console.log(`ℹ️ DuckDuckGo: No specific results found, creating general search result`);
        results.push({
          title: `Search results for: ${query}`,
          link: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: `No specific information found about "${query}" in DuckDuckGo's instant answers. This may be a valid entity that requires verification through additional sources.`,
          rank: 1,
          source: 'DuckDuckGo Search',
          extractedInfo: {
            facts: [`Search performed for: ${query}`],
            entities: [query],
            dates: [],
            numbers: []
          }
        });
      }

      console.log(`✅ DuckDuckGo: Returning ${results.length} results for "${query}"`);
      return results;
      
    } catch (error) {
      console.error(`❌ DuckDuckGo search failed for "${query}":`, error.message);
      
      // Return a fallback result indicating the search attempt
      return [{
        title: `Search attempted for: ${query}`,
        link: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Search for "${query}" was attempted but failed. This entity may need manual verification.`,
        rank: 1,
        source: 'DuckDuckGo (Error)',
        extractedInfo: {
          facts: [`Search failed for: ${query}`],
          entities: [query],
          dates: [],
          numbers: []
        }
      }];
    }
  }

  private extractInfoFromSnippet(snippet: string): {
    facts: string[];
    entities: string[];
    dates: string[];
    numbers: string[];
  } {
    const facts: string[] = [];
    const entities: string[] = [];
    const dates: string[] = [];
    const numbers: string[] = [];

    // Extract dates (various formats)
    const dateRegex = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b|\b\d{1,2}\s+(jaanuar|veebruar|märts|aprill|mai|juuni|juuli|august|september|oktoober|november|detsember)\s+\d{4}\b/gi;
    const dateMatches = snippet.match(dateRegex);
    if (dateMatches) {
      dates.push(...dateMatches);
    }

    // Extract numbers and quantities
    const numberRegex = /\b\d+([.,]\d+)?\s*(miljonit?|tuhat|miljardit?|protsenti?|%|€|EUR|USD|\$)?\b/gi;
    const numberMatches = snippet.match(numberRegex);
    if (numberMatches) {
      numbers.push(...numberMatches);
    }

    // Extract potential entities (capitalized words/phrases)
    const entityRegex = /\b[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+(?:\s+[A-ZÄÖÜÕŠŽ][a-zäöüõšž]+)*\b/g;
    const entityMatches = snippet.match(entityRegex);
    if (entityMatches) {
      entities.push(...new Set(entityMatches)); // Remove duplicates
    }

    // Extract factual statements (sentences with verbs)
    const sentences = snippet.split(/[.!?]+/).filter(s => s.trim().length > 10);
    facts.push(...sentences.slice(0, 3)); // Take first 3 substantial sentences

    return { facts, entities, dates, numbers };
  }

  private async processSearchResults(results: SearchResult[], originalQuery: string, context?: string): Promise<WebSearchResponse> {
    const topResult = results.length > 0 ? results[0] : null;
    const allFacts: string[] = [];
    const allEntities: string[] = [];
    
    // Collect all extracted information
    results.forEach(result => {
      if (result.extractedInfo) {
        allFacts.push(...result.extractedInfo.facts);
        allEntities.push(...result.extractedInfo.entities);
      }
    });

    // Entity verification logic
    const entityVerifications = this.verifyEntitiesInResults(originalQuery, allEntities, results);

    // Generate consensus or identify contradictions
    const consensus = this.generateConsensus(results, originalQuery);
    const contradictions = this.findContradictions(results);

    return {
      query: originalQuery,
      results,
      totalResults: results.length,
      summary: {
        topResult,
        factualClaims: [...new Set(allFacts)].slice(0, 5),
        entityVerifications,
        consensus,
        contradictions
      },
      searchProvider: this.searchProvider
    };
  }

  private verifyEntitiesInResults(query: string, entities: string[], results: SearchResult[]): Array<{
    entity: string;
    verified: boolean;
    confidence: number;
    evidence: string;
  }> {
    const queryWords = query.toLowerCase().split(/\s+/);
    const verifications: Array<{
      entity: string;
      verified: boolean;
      confidence: number;
      evidence: string;
    }> = [];

    // Check if query terms appear in search results
    queryWords.forEach(word => {
      if (word.length > 2) { // Skip short words
        const mentions = results.filter(result => 
          result.snippet.toLowerCase().includes(word) || 
          result.title.toLowerCase().includes(word)
        );
        
        if (mentions.length > 0) {
          verifications.push({
            entity: word,
            verified: mentions.length >= 2, // Verified if mentioned in 2+ results
            confidence: Math.min(mentions.length * 0.3, 1.0),
            evidence: mentions[0].snippet.substring(0, 200) + '...'
          });
        }
      }
    });

    return verifications;
  }

  private generateConsensus(results: SearchResult[], query: string): string {
    if (results.length === 0) return 'No search results available';
    if (results.length === 1) return results[0].snippet.substring(0, 200) + '...';

    // Find common themes across results
    const commonWords = this.findCommonWords(results.map(r => r.snippet));
    const topResult = results[0];
    
    return `Based on ${results.length} search results, ${topResult.snippet.substring(0, 150)}... Common themes: ${commonWords.slice(0, 3).join(', ')}.`;
  }

  private findContradictions(results: SearchResult[]): string[] {
    // Simple contradiction detection - this could be enhanced with NLP
    const contradictions: string[] = [];
    
    if (results.length > 1) {
      // Look for negating words across different results
      const negationPatterns = ['not', 'no', 'never', 'false', 'incorrect', 'wrong', 'ei ole', 'mitte'];
      
      results.forEach((result, i) => {
        const hasNegation = negationPatterns.some(pattern => 
          result.snippet.toLowerCase().includes(pattern)
        );
        
        if (hasNegation && i > 0) {
          contradictions.push(`Result ${i + 1} contains contradictory information`);
        }
      });
    }
    
    return contradictions;
  }

  private findCommonWords(texts: string[]): string[] {
    const wordCounts: Record<string, number> = {};
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'ja', 'on', 'ei', 'või', 'ning', 'ka', 'kui', 'et', 'see', 'seda', 'selle', 'tema', 'ta']);

    texts.forEach(text => {
      const words: string[] = text.toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(word => {
        if (word.length > 3 && !stopWords.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordCounts)
      .filter(([word, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([word]) => word);
  }

  private formatResponse(result: WebSearchResponse): string {
    const { query, results, summary } = result;
    
    let response = `Web Search Results for: "${query}"\n\n`;
    
    // Summary section
    if (summary) {
      response += `📊 Search Summary:\n`;
      response += `- Found ${results.length} results from ${result.searchProvider}\n`;
      
      if (summary.consensus) {
        response += `- Consensus: ${summary.consensus}\n`;
      }
      
      if (summary.contradictions && summary.contradictions.length > 0) {
        response += `- ⚠️ Contradictions detected: ${summary.contradictions.join(', ')}\n`;
      }
      
      if (summary.entityVerifications.length > 0) {
        const verifiedEntities = summary.entityVerifications.filter(e => e.verified);
        response += `- Entity verification: ${verifiedEntities.length}/${summary.entityVerifications.length} entities verified\n`;
      }
      
      response += `\n`;
    }

    // Top results
    if (results.length === 0) {
      response += `❌ No search results found.\n`;
    } else {
      response += `🔍 Search Results:\n\n`;
      
      results.slice(0, 3).forEach((result, index) => {
        response += `${index + 1}. **${result.title}**\n`;
        response += `   🔗 ${result.link}\n`;
        response += `   📝 ${result.snippet}\n`;
        response += `   📊 Source: ${result.source}\n`;
        
        if (result.extractedInfo) {
          if (result.extractedInfo.entities.length > 0) {
            response += `   🏷️ Entities: ${result.extractedInfo.entities.slice(0, 3).join(', ')}\n`;
          }
          if (result.extractedInfo.dates.length > 0) {
            response += `   📅 Dates: ${result.extractedInfo.dates.slice(0, 2).join(', ')}\n`;
          }
        }
        
        response += `\n`;
      });
      
      if (results.length > 3) {
        response += `... and ${results.length - 3} more results\n\n`;
      }
    }

    // Entity verification details
    if (summary?.entityVerifications && summary.entityVerifications.length > 0) {
      response += `🔍 Entity Verification:\n`;
      summary.entityVerifications.forEach(verification => {
        const icon = verification.verified ? '✅' : '❌';
        response += `${icon} "${verification.entity}" - Confidence: ${(verification.confidence * 100).toFixed(0)}%\n`;
        if (verification.evidence) {
          response += `   Evidence: ${verification.evidence.substring(0, 100)}...\n`;
        }
      });
      response += `\n`;
    }

    return response;
  }

  /**
   * Helper method to search for specific entity verification
   */
  static async verifyEntity(entity: string, context?: string, maxResults: number = 3): Promise<{
    verified: boolean;
    confidence: number;
    evidence: string[];
  }> {
    try {
      const searchTool = new WebSearchTool();
      const query = context ? `"${entity}" ${context}` : `"${entity}"`;
      
      const searchInput = JSON.stringify({
        query,
        context,
        maxResults
      });
      
      const result = await searchTool._call(searchInput);
      
      // Parse result to extract verification info
      const verified = result.includes('✅') && !result.includes('❌');
      const confidenceMatch = result.match(/Confidence: (\d+)%/);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.5;
      
      // Extract evidence snippets
      const evidenceRegex = /Evidence: ([^\.]+)/g;
      const evidence: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = evidenceRegex.exec(result)) !== null) {
        if (match[1]) {
          evidence.push(match[1]);
        }
      }
      
      return {
        verified,
        confidence,
        evidence
      };
    } catch (error) {
      console.error('Error verifying entity:', error);
      return {
        verified: false,
        confidence: 0,
        evidence: []
      };
    }
  }

  /**
   * Helper method to search for factual verification
   */
  static async verifyFact(claim: string, context?: string): Promise<{
    supported: boolean;
    confidence: number;
    supportingEvidence: string[];
    contradictingEvidence: string[];
  }> {
    try {
      const searchTool = new WebSearchTool();
      const query = context ? `"${claim}" ${context}` : claim;
      
      const searchInput = JSON.stringify({
        query,
        context,
        maxResults: 5
      });
      
      const result = await searchTool._call(searchInput);
      
      // Simple fact verification logic
      const supported = !result.includes('⚠️ Contradictions detected');
      const confidenceMatch = result.match(/Consensus: (.+)/);
      const confidence = confidenceMatch ? 0.8 : 0.5;
      
      return {
        supported,
        confidence,
        supportingEvidence: [result.substring(0, 200)],
        contradictingEvidence: []
      };
    } catch (error) {
      console.error('Error verifying fact:', error);
      return {
        supported: false,
        confidence: 0,
        supportingEvidence: [],
        contradictingEvidence: []
      };
    }
  }
}

// Export a factory function for easy creation
export function createWebSearchTool(options?: {
  searchProvider?: 'serpapi' | 'google' | 'bing' | 'duckduckgo';
  apiKey?: string;
  searchEngineId?: string;
}): WebSearchTool {
  return new WebSearchTool(options);
} 