import { ChatOpenAI } from "@langchain/openai";
import { OPENROUTER_API_KEY } from "$env/static/private";

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
      "OPENROUTER_API_KEY environment variable is not set. " +
      "Please add it to your .env file. " +
      "Get your API key from https://openrouter.ai/"
    );
  }

  const {
    modelName = "anthropic/claude-3.5-sonnet",
    temperature = 0.7,
    maxTokens = 4096,
  } = config;

  // For LangChain's OpenAI client, we need to pass configuration differently
  const chat = new ChatOpenAI({
    modelName: modelName,
    temperature,
    maxTokens,
    openAIApiKey: OPENROUTER_API_KEY,
    // Pass base URL and other config through clientOptions
    clientOptions: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://tekstiks.ee",
        "X-Title": "EST-ASR Transcript Analyzer",
      },
    },
  } as any);

  return chat;
}

/**
 * Available models on OpenRouter for transcript analysis
 */
export const OPENROUTER_MODELS = {
  // Claude models - good for Estonian/Finnish language understanding
  CLAUDE_3_5_SONNET: "anthropic/claude-3.5-sonnet",
  CLAUDE_3_5_HAIKU: "anthropic/claude-3.5-haiku",
  CLAUDE_3_OPUS: "anthropic/claude-3-opus",
  
  // GPT models
  GPT_4_TURBO: "openai/gpt-4-turbo",
  GPT_4O: "openai/gpt-4o",
  GPT_4O_MINI: "openai/gpt-4o-mini",
  
  // Open source models
  LLAMA_3_1_70B: "meta-llama/llama-3.1-70b-instruct",
  MIXTRAL_8X7B: "mistralai/mixtral-8x7b-instruct",
  
  // Specialized for long context
  CLAUDE_3_5_SONNET_200K: "anthropic/claude-3.5-sonnet-20241022",
} as const;

export type OpenRouterModel = typeof OPENROUTER_MODELS[keyof typeof OPENROUTER_MODELS];