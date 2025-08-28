import { ChatOpenAI } from '@langchain/openai';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { OPENROUTER_MODELS, type OpenRouterModel, DEFAULT_MODEL } from '$lib/config/models';

export interface OpenRouterConfig {
	modelName?: string;
	temperature?: number;
	maxTokens?: number;
}

/**
 * Create a ChatOpenAI instance configured for OpenRouter
 * Using the configuration options available in the current LangChain version
 */
export function createOpenRouterChat(config: OpenRouterConfig = {}) {
	if (!OPENROUTER_API_KEY) {
		throw new Error(
			'OPENROUTER_API_KEY environment variable is not set. ' +
				'Please add it to your .env file. ' +
				'Get your API key from https://openrouter.ai/'
		);
	}

	const { modelName = DEFAULT_MODEL, temperature = 0.7, maxTokens = 4096 } = config;

	// For LangChain's OpenAI client, we need to pass configuration differently
	const chat = new ChatOpenAI({
		modelName: modelName,
		temperature,
		maxTokens,
		openAIApiKey: OPENROUTER_API_KEY,
		// Pass base URL and other config through clientOptions
		clientOptions: {
			baseURL: 'https://openrouter.ai/api/v1',
			defaultHeaders: {
				Authorization: `Bearer ${OPENROUTER_API_KEY}`,
				'HTTP-Referer': 'https://tekstiks.ee',
				'X-Title': 'EST-ASR Transcript Analyzer'
			}
		}
	} as any);

	return chat;
}

// Re-export from centralized config for backward compatibility
export { OPENROUTER_MODELS, type OpenRouterModel, DEFAULT_MODEL } from '$lib/config/models';
