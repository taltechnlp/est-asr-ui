import OpenAI from 'openai';
import { OPENROUTER_MODELS, type OpenRouterModel, DEFAULT_MODEL, DEFAULT_MODEL_NAME } from '$lib/config/models';

// Conditionally import API key to avoid client-side leakage
let OPENROUTER_API_KEY: string = '';
if (typeof window === 'undefined') {
	try {
		OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
	} catch (e) {
		console.warn('OPENROUTER_API_KEY not available in client context');
	}
}

export interface OpenRouterConfig {
	modelName?: string;
	temperature?: number;
	maxTokens?: number;
}

interface OpenRouterResponse {
	choices: Array<{
		message: {
			content: string;
			role: string;
		};
		finish_reason: string | null;
		index: number;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

/**
 * OpenRouter API implementation using OpenAI SDK
 * This follows OpenRouter's recommended approach using the official OpenAI SDK
 */
export class OpenRouterChat {
	private client: OpenAI | null = null;
	private modelName: string;
	private temperature: number;
	private maxTokens: number;

	constructor(config: OpenRouterConfig = {}) {
		// Only initialize OpenAI client on server side
		if (typeof window === 'undefined') {
			if (!OPENROUTER_API_KEY) {
				console.error('OPENROUTER_API_KEY environment check failed:', {
					hasKey: !!process.env.OPENROUTER_API_KEY,
					keyLength: process.env.OPENROUTER_API_KEY?.length || 0,
					env: process.env.NODE_ENV
				});
				throw new Error(
					'OPENROUTER_API_KEY environment variable is not set. ' +
						'Please add it to your .env file. ' +
						'Get your API key from https://openrouter.ai/'
				);
			}

			console.log(`OpenRouter client initialized: ${config.modelName || DEFAULT_MODEL}`);

			this.client = new OpenAI({
				baseURL: 'https://openrouter.ai/api/v1',
				apiKey: OPENROUTER_API_KEY,
				defaultHeaders: {
					'HTTP-Referer': 'https://tekstiks.ee',
					'X-Title': 'EST-ASR Transcript Analyzer'
				}
			});
		}

		this.modelName = config.modelName || DEFAULT_MODEL;
		this.temperature = config.temperature || 0.7;
		this.maxTokens = config.maxTokens || 8192; // Increased for better analysis responses
	}

	async invoke(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> {
		// Check if running in client-side context
		if (typeof window !== 'undefined') {
			throw new Error('OpenRouter API calls can only be made from server-side code');
		}

		if (!this.client) {
			throw new Error('OpenAI client not initialized (server-side only)');
		}

		// Validate API key before making requests
		if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === '') {
			throw new Error('OPENROUTER_API_KEY is empty or undefined');
		}

		// Retry configuration
		const maxRetries = 3;
		const baseDelay = 1000; // 1 second

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				// Prepare base parameters
				const completionParams: any = {
					model: this.modelName,
					messages: messages.map(msg => ({
						role: msg.role as 'user' | 'assistant' | 'system',
						content: msg.content
					})),
					temperature: this.temperature,
					max_tokens: this.maxTokens
				};

				// Add reasoning control for thinking models to reduce token usage
				if (this.modelName.includes('gemini')) {
					completionParams.reasoning = {
						max_tokens: Math.min(2048, Math.floor(this.maxTokens * 0.2)), // Limit thinking to 20% of max tokens (doubled)
						exclude: false // Keep reasoning visible for debugging, but limit tokens
					};
					console.log(`Applied Gemini reasoning limits: max_tokens=${completionParams.reasoning.max_tokens}`);
				} else if (this.modelName.includes('gpt-5')) {
					// For GPT-5: use medium effort only (can't combine with max_tokens)
					completionParams.reasoning = {
						effort: "medium", // Use medium effort - equivalent to ~50% of max tokens for thinking
						exclude: false // Keep reasoning visible for debugging
					};
					console.log(`Applied GPT-5 medium-effort reasoning: effort=medium`);
				}

				const completion = await this.client.chat.completions.create(completionParams);

				if (!completion.choices || completion.choices.length === 0) {
					throw new Error('No choices in response from OpenRouter');
				}

				const choice = completion.choices[0];
				const content = choice.message.content;
				const finishReason = choice.finish_reason;

				// Enhanced error handling based on finish_reason
				if (!content || content.trim().length === 0) {
					let errorMsg = `Empty response from model ${this.modelName}`;
					
					if (finishReason === 'length') {
						errorMsg += ' - Response was truncated due to token limit. Try increasing max_tokens or reducing prompt length.';
					} else if (finishReason === 'content_filter') {
						errorMsg += ' - Content was filtered by the model\'s safety systems.';
					} else if (finishReason === 'function_call') {
						errorMsg += ' - Model attempted to make function calls but none were provided.';
					} else if (!finishReason || finishReason === null) {
						errorMsg += ' - Model may need warm-up time. This qualifies for OpenRouter\'s Zero Completion Insurance.';
					} else {
						errorMsg += ` - Finish reason: ${finishReason}`;
					}

					throw new Error(errorMsg);
				}

				// Log successful completion details
				console.log(`OpenRouter API success: Model ${this.modelName}, finish_reason: ${finishReason}, tokens: ${completion.usage?.total_tokens || 'unknown'}`);
				return { content };

			} catch (error: any) {
				const isLastAttempt = attempt === maxRetries - 1;
				const isTimeout = error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout');
				const isNetworkError = error?.code === 'ECONNRESET' || error?.message?.includes('network') || error?.message?.includes('fetch failed');
				const isEmptyResponse = error?.message?.includes('Empty response from model');
				const isRateLimited = error?.status === 429;
				const isAuthError = error?.status === 401 || error?.message?.includes('No auth credentials found');
				const isTerminated = error?.message === 'terminated';

				if (isTimeout || isNetworkError || isEmptyResponse || isRateLimited || isAuthError || isTerminated) {
					console.error(
						`OpenRouter API attempt ${attempt + 1}/${maxRetries} failed:`,
						isTimeout ? 'Request timeout' : 
						isNetworkError ? 'Network error' : 
						isRateLimited ? 'Rate limited' :
						isAuthError ? 'Authentication error (retrying)' :
						isTerminated ? 'Connection terminated (retrying)' :
						'Empty response'
					);

					if (!isLastAttempt) {
						// Exponential backoff with jitter, extra delay for rate limiting and auth errors
						const delay = (baseDelay * Math.pow(2, attempt) + Math.random() * 1000) * ((isRateLimited || isAuthError) ? 2 : 1);
						console.log(`Retrying in ${Math.round(delay)}ms...`);
						await new Promise((resolve) => setTimeout(resolve, delay));
						continue;
					}

					// Final attempt failed
					if (isEmptyResponse) {
						throw new Error(
							`Model ${this.modelName} returned empty responses after ${maxRetries} attempts. ` +
							`This may be due to model warm-up requirements or configuration issues. ` +
							`Consider trying a different model or waiting a few minutes.`
						);
					}
					
					if (isRateLimited) {
						throw new Error(
							`Rate limit exceeded for model ${this.modelName} after ${maxRetries} attempts. ` +
							`Please wait before making more requests or consider using a different model.`
						);
					}
					
					if (isAuthError) {
						throw new Error(
							`Authentication failed for model ${this.modelName} after ${maxRetries} attempts. ` +
							`API key may be invalid or there may be temporary authentication issues. ` +
							`Please check your OPENROUTER_API_KEY and try again.`
						);
					}
					
					if (isTerminated) {
						throw new Error(
							`Connection terminated for model ${this.modelName} after ${maxRetries} attempts. ` +
							`This may be due to transient network issues or server problems. ` +
							`Please try again in a few minutes.`
						);
					}
					
					throw new Error(
						`OpenRouter API failed after ${maxRetries} attempts. ` +
							`${isTimeout ? 'Request timed out' : 'Network connectivity issue'}. ` +
							`Please check your internet connection and try again.`
					);
				}

				// Non-retryable error - log full error details
				console.error('OpenRouter API error (non-retryable):', {
					message: error.message,
					status: error.status,
					code: error.code,
					model: this.modelName
				});
				throw error;
			}
		}

		// Should never reach here
		throw new Error('OpenRouter API failed unexpectedly');
	}
}

/**
 * Create a simple wrapper that's compatible with the LangChain interface
 */
export function createOpenRouterChat(config: OpenRouterConfig = {}) {
	const client = new OpenRouterChat(config);

	// Create a wrapper that mimics LangChain's ChatOpenAI interface
	return {
		async invoke(messages: any[]): Promise<any> {
			// Check if running in client-side context
			if (typeof window !== 'undefined') {
				throw new Error('OpenRouter API calls can only be made from server-side code');
			}

			// Convert LangChain message format to OpenRouter format with proper role mapping
			console.log(`Converting ${messages.length} LangChain messages to OpenRouter format`);

			const formattedMessages = messages.map((msg, index) => {
				const type = msg._getType();
				let role: 'user' | 'assistant' | 'system';
				
				switch (type) {
					case 'human':
						role = 'user';
						break;
					case 'ai':
						role = 'assistant';
						break;
					case 'system':
						role = 'system';
						break;
					default:
						console.error(`Invalid message at index ${index}:`, {
							type,
							hasGetType: typeof msg._getType === 'function',
							messageKeys: Object.keys(msg),
							message: msg
						});
						throw new Error(`Unsupported LangChain message type: ${type}. Expected 'human', 'ai', or 'system'.`);
				}

				if (typeof msg.content !== 'string') {
					console.error(`Invalid content at index ${index}:`, {
						contentType: typeof msg.content,
						content: msg.content,
						messageType: type
					});
					throw new Error(`Message content must be a string. Received: ${typeof msg.content} - ${JSON.stringify(msg.content)}`);
				}

				return {
					role: role,
					content: msg.content
				};
			});

			console.log(`Formatted messages: ${formattedMessages.map(m => `${m.role}(${m.content.length})`).join(', ')}`);

			const response = await client.invoke(formattedMessages);

			// Return in LangChain format
			return {
				content: response.content,
				_getType() {
					return 'ai';
				}
			};
		},

		// Add bindTools method for compatibility
		bindTools(_tools: any[]) {
			console.warn('Tools not supported in direct OpenRouter implementation');
			return this;
		}
	};
}

// Re-export from centralized config for backward compatibility
export { OPENROUTER_MODELS, type OpenRouterModel, DEFAULT_MODEL, DEFAULT_MODEL_NAME } from '$lib/config/models';
