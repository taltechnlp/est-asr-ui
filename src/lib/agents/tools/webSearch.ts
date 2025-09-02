import { z } from 'zod';
import { TranscriptAnalysisTool } from './base';
import { getCurrentLogger } from '../../utils/agentFileLogger';

const WebSearchSchema = z.object({
	query: z.string().describe('Search query to look up'),
	language: z.enum(['et', 'fi', 'en']).describe('Language for search results'),
	maxResults: z.number().default(5).describe('Maximum number of results to return')
});

export interface SearchResult {
	title: string;
	snippet: string;
	url: string;
	publishedDate?: string;
	score?: number;
}

export interface WebSearchResult {
	query: string;
	results: SearchResult[];
	totalResults: number;
}

export class WebSearchTool extends TranscriptAnalysisTool {
	constructor() {
		super(
			'web_search',
			'Search the web for information about specific terms or concepts',
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
					'User-Agent': 'Mozilla/5.0 (compatible; TranscriptAnalyzer/1.0)'
				}
			});

			if (!response.ok) {
				throw new Error(`Search failed: ${response.status}`);
			}

			const html = await response.text();

			// Parse search results from HTML
			// This is a simplified parser - in production, use a proper HTML parser
			const results: SearchResult[] = [];
			const resultPattern =
				/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)</g;

			let match;
			let count = 0;
			while ((match = resultPattern.exec(html)) !== null && count < maxResults) {
				results.push({
					url: match[1],
					title: this.decodeHtml(match[2]),
					snippet: this.decodeHtml(match[3])
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
				totalResults: results.length
			};
		} catch (error) {
			console.error('Web search error:', error);

			// Return a helpful fallback result
			return {
				query,
				results: [
					{
						title: 'Search Error',
						snippet: `Failed to search for "${query}". The term might be too specific or the search service is temporarily unavailable.`,
						url: '#'
					}
				],
				totalResults: 0
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

// Modern Exa search implementation (requires API key)
export class ExaSearchTool extends TranscriptAnalysisTool {
	private apiKey: string;

	constructor(apiKey: string) {
		super(
			'exa_search',
			'Search the web using Exa AI search for high-quality, semantic results',
			WebSearchSchema,
			async (input) => {
				const result = await this.searchExa(input);
				return JSON.stringify(result);
			}
		);
		this.apiKey = apiKey;
	}

	async searchExa(input: z.infer<typeof WebSearchSchema>): Promise<WebSearchResult> {
		const { query, language, maxResults } = input;
		const logger = getCurrentLogger();

		try {
			await logger?.logToolExecution('ExaSearch', 'Starting Exa search request', {
				query,
				language,
				maxResults
			});

			// Build search parameters optimized for Estonian ASR context
			const searchParams = {
				query: query,
				numResults: Math.min(maxResults, 10),
				type: 'neural', // Use neural search for better semantic understanding
				useAutoprompt: true, // Enhance query with AI
				contents: {
					text: {
						maxCharacters: 2000,
						includeHtmlTags: false
					}
				},
				// Language-specific domain preferences
				...(language === 'et' && {
					includeDomains: ['wikipedia.org', '.ee', 'eesti.ee', 'riik.ee']
				}),
				...(language === 'fi' && {
					includeDomains: ['wikipedia.org', '.fi', 'suomi.fi']
				})
			};

			const response = await fetch('https://api.exa.ai/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.apiKey
				},
				body: JSON.stringify(searchParams)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Exa Search API error: ${response.status} - ${errorText}`);
			}

			const data = await response.json();

			await logger?.logToolExecution('ExaSearch', 'Received Exa search response', {
				resultsFound: data.results?.length || 0,
				requestId: data.requestId
			});

			const results: SearchResult[] =
				data.results?.map((result: any) => ({
					title: result.title || 'Untitled',
					snippet: this.extractBestSnippet(result.text || result.summary || '', query),
					url: result.url,
					publishedDate: result.publishedDate,
					score: result.score
				})) || [];

			return {
				query,
				results,
				totalResults: data.results?.length || 0
			};
		} catch (error) {
			await logger?.logToolExecution('ExaSearch', 'Exa search failed', {
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			// Fallback to basic search if available
			console.error('Exa search error:', error);
			throw new Error(
				`Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	private extractBestSnippet(text: string, query: string): string {
		if (!text) return 'No content available.';

		const words = query.toLowerCase().split(/\s+/);
		const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);

		// Find sentence that contains the most query words
		let bestSentence = sentences[0] || text.substring(0, 200);
		let maxMatches = 0;

		for (const sentence of sentences) {
			const lowerSentence = sentence.toLowerCase();
			const matches = words.filter((word) => lowerSentence.includes(word)).length;

			if (matches > maxMatches) {
				maxMatches = matches;
				bestSentence = sentence;
			}
		}

		// Trim to reasonable length
		if (bestSentence.length > 300) {
			bestSentence = bestSentence.substring(0, 297) + '...';
		}

		return bestSentence.trim();
	}
}

// Legacy Bing implementation for fallback
export class BingSearchTool extends TranscriptAnalysisTool {
	private apiKey: string;

	constructor(apiKey: string) {
		super(
			'bing_search',
			'Search the web using Bing Search API for reliable results',
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
						'Ocp-Apim-Subscription-Key': this.apiKey
					}
				}
			);

			if (!response.ok) {
				throw new Error(`Bing Search API error: ${response.status}`);
			}

			const data = await response.json();

			const results: SearchResult[] =
				data.webPages?.value?.map((page: any) => ({
					title: page.name,
					snippet: page.snippet,
					url: page.url
				})) || [];

			return {
				query,
				results,
				totalResults: data.webPages?.totalEstimatedMatches || 0
			};
		} catch (error) {
			console.error('Bing search error:', error);
			throw new Error(
				`Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}
}

// Factory functions with automatic API key detection
export function createWebSearchTool(): WebSearchTool | ExaSearchTool {
	// Try Exa first if API key is available
	const exaApiKey = process.env.EXA_API_KEY;
	if (exaApiKey && typeof window === 'undefined') {
		return new ExaSearchTool(exaApiKey);
	}

	// Fallback to basic DuckDuckGo search
	return new WebSearchTool();
}

export function createExaSearchTool(apiKey?: string): ExaSearchTool {
	const key = apiKey || process.env.EXA_API_KEY;
	if (!key) {
		throw new Error(
			'Exa API key is required. Set EXA_API_KEY environment variable or provide key parameter.'
		);
	}
	return new ExaSearchTool(key);
}

export function createBingSearchTool(apiKey?: string): BingSearchTool {
	const key = apiKey || process.env.BING_SEARCH_API_KEY;
	if (!key) {
		throw new Error(
			'Bing API key is required. Set BING_SEARCH_API_KEY environment variable or provide key parameter.'
		);
	}
	return new BingSearchTool(key);
}

// Helper to get the best available search tool
export function getBestSearchTool(): WebSearchTool | ExaSearchTool | BingSearchTool {
	// Priority: Exa > Bing > DuckDuckGo
	try {
		return createExaSearchTool();
	} catch {
		try {
			return createBingSearchTool();
		} catch {
			return new WebSearchTool(); // DuckDuckGo fallback (no API key needed)
		}
	}
}
