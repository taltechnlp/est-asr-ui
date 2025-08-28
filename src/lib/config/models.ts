/**
 * Centralized model configuration for the entire application
 * Change DEFAULT_MODEL to switch the model used across all components
 */

// Available models on OpenRouter for transcript analysis
export const OPENROUTER_MODELS = {
	// Claude models - good for Estonian/Finnish language understanding
	CLAUDE_3_5_SONNET: 'anthropic/claude-3.5-sonnet',
	CLAUDE_3_5_HAIKU: 'anthropic/claude-3.5-haiku',
	CLAUDE_3_OPUS: 'anthropic/claude-3-opus',

	// GPT models
	GPT_5: 'openai/gpt-5',
	GPT_4_TURBO: 'openai/gpt-4-turbo',
	GPT_4O: 'openai/gpt-4o',
	GPT_4O_MINI: 'openai/gpt-4o-mini',

	// Open source models
	LLAMA_3_1_70B: 'meta-llama/llama-3.1-70b-instruct',
	MIXTRAL_8X7B: 'mistralai/mixtral-8x7b-instruct',

	// Specialized for long context
	CLAUDE_3_5_SONNET_200K: 'anthropic/claude-3.5-sonnet-20241022'
} as const;

export type OpenRouterModel = (typeof OPENROUTER_MODELS)[keyof typeof OPENROUTER_MODELS];

/**
 * Default model used across the entire application
 * Change this single variable to switch models everywhere
 */
export const DEFAULT_MODEL = OPENROUTER_MODELS.GPT_5;

/**
 * Default model name for display in logs and UI
 */
export const DEFAULT_MODEL_NAME = 'GPT-5';

/**
 * Available models for UI selection with display labels
 */
export const AVAILABLE_MODELS_FOR_UI = [
	{ value: OPENROUTER_MODELS.GPT_5, label: 'GPT-5' },
	{ value: OPENROUTER_MODELS.GPT_4O, label: 'GPT-4o' },
	{ value: OPENROUTER_MODELS.CLAUDE_3_5_SONNET, label: 'Claude 3.5 Sonnet' },
	{ value: OPENROUTER_MODELS.CLAUDE_3_5_HAIKU, label: 'Claude 3.5 Haiku (Faster)' },
	{ value: OPENROUTER_MODELS.GPT_4O_MINI, label: 'GPT-4o Mini (Faster)' },
] as const;