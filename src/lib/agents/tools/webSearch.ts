import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";

const WebSearchSchema = z.object({
  query: z.string().describe("Search query to look up"),
  language: z.enum(["et", "fi", "en"]).describe("Language for search results"),
  maxResults: z.number().default(5).describe("Maximum number of results to return"),
});

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchResult {
  query: string;
  results: SearchResult[];
  totalResults: number;
}

export class WebSearchTool extends TranscriptAnalysisTool {
  constructor() {
    super(
      "web_search",
      "Search the web for information about specific terms or concepts",
      WebSearchSchema,
      async (input) => {
        const result = await this.searchWeb(input);
        return JSON.stringify(result);
      }
    );
  }

  async searchWeb(input: z.infer<typeof WebSearchSchema>): Promise<WebSearchResult> {
    const { query, language, maxResults } = input;
    
    try {
      // Using DuckDuckGo HTML search as it doesn't require API key
      // For production, consider using a proper search API
      const searchUrl = new URL('https://html.duckduckgo.com/html/');
      searchUrl.searchParams.append('q', query);
      
      // Add language-specific site restrictions for better results
      const languageSites = {
        et: 'site:.ee OR site:et.wikipedia.org',
        fi: 'site:.fi OR site:fi.wikipedia.org',
        en: ''
      };
      
      if (languageSites[language]) {
        searchUrl.searchParams.set('q', `${query} ${languageSites[language]}`);
      }

      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TranscriptAnalyzer/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      
      // Parse search results from HTML
      // This is a simplified parser - in production, use a proper HTML parser
      const results: SearchResult[] = [];
      const resultPattern = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)</g;
      
      let match;
      let count = 0;
      while ((match = resultPattern.exec(html)) !== null && count < maxResults) {
        results.push({
          url: match[1],
          title: this.decodeHtml(match[2]),
          snippet: this.decodeHtml(match[3]),
        });
        count++;
      }

      // If DuckDuckGo parsing fails, return empty results instead of generic message
      if (results.length === 0) {
        console.log(`No search results found for query: "${query}"`);
      }

      return {
        query,
        results,
        totalResults: results.length,
      };

    } catch (error) {
      console.error('Web search error:', error);
      
      // Return a helpful fallback result
      return {
        query,
        results: [{
          title: 'Search Error',
          snippet: `Failed to search for "${query}". The term might be too specific or the search service is temporarily unavailable.`,
          url: '#',
        }],
        totalResults: 0,
      };
    }
  }

  private decodeHtml(html: string): string {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
  }
}

// Alternative implementation using a more robust search API (requires API key)
export class BingSearchTool extends TranscriptAnalysisTool {
  private apiKey: string;

  constructor(apiKey: string) {
    super(
      "bing_search",
      "Search the web using Bing Search API for more reliable results",
      WebSearchSchema,
      async (input) => {
        const result = await this.searchBing(input);
        return JSON.stringify(result);
      }
    );
    this.apiKey = apiKey;
  }

  async searchBing(input: z.infer<typeof WebSearchSchema>): Promise<WebSearchResult> {
    const { query, language, maxResults } = input;
    
    try {
      const marketMap = {
        et: 'et-EE',
        fi: 'fi-FI',
        en: 'en-US'
      };

      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}&mkt=${marketMap[language]}`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Bing Search API error: ${response.status}`);
      }

      const data = await response.json();
      
      const results: SearchResult[] = data.webPages?.value?.map((page: any) => ({
        title: page.name,
        snippet: page.snippet,
        url: page.url,
      })) || [];

      return {
        query,
        results,
        totalResults: data.webPages?.totalEstimatedMatches || 0,
      };

    } catch (error) {
      console.error('Bing search error:', error);
      throw new Error(`Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export function createWebSearchTool(): WebSearchTool {
  return new WebSearchTool();
}

export function createBingSearchTool(apiKey: string): BingSearchTool {
  return new BingSearchTool(apiKey);
}