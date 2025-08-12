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
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Direct OpenRouter API implementation without LangChain
 * This ensures we're definitely hitting OpenRouter and not OpenAI
 */
export class OpenRouterChat {
  private apiKey: string;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: OpenRouterConfig = {}) {
    // Only check for API key on server side
    if (typeof window === 'undefined' && !OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY environment variable is not set. " +
        "Please add it to your .env file. " +
        "Get your API key from https://openrouter.ai/"
      );
    }

    this.apiKey = OPENROUTER_API_KEY;
    this.modelName = config.modelName || "openai/gpt-4o";
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
  }

  async invoke(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> {
    // Check if running in client-side context
    if (typeof window !== 'undefined') {
      throw new Error('OpenRouter API calls can only be made from server-side code');
    }

    // Retry configuration
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    const timeout = 30000; // 30 seconds
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://tekstiks.ee",
            "X-Title": "EST-ASR Transcript Analyzer",
          },
          body: JSON.stringify({
            model: this.modelName,
            messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data: OpenRouterResponse = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
          throw new Error("No response from OpenRouter");
        }

        return { content: data.choices[0].message.content };
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isTimeout = error?.name === 'AbortError' || error?.code === 'ETIMEDOUT';
        const isNetworkError = error?.cause?.code === 'ETIMEDOUT' || error?.message?.includes('fetch failed');
        
        if (isTimeout || isNetworkError) {
          console.error(`OpenRouter API attempt ${attempt + 1}/${maxRetries} failed:`, 
            isTimeout ? 'Request timeout' : 'Network error');
          
          if (!isLastAttempt) {
            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            console.log(`Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          // Final attempt failed
          throw new Error(
            `OpenRouter API failed after ${maxRetries} attempts. ` +
            `${isTimeout ? 'Request timed out' : 'Network connectivity issue'}. ` +
            `Please check your internet connection and try again.`
          );
        }
        
        // Non-retryable error
        console.error("OpenRouter API error:", error);
        throw error;
      }
    }
    
    // Should never reach here
    throw new Error("OpenRouter API failed unexpectedly");
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

      // Convert LangChain message format to OpenRouter format
      const formattedMessages = messages.map(msg => {
        if (msg.content) {
          return {
            role: msg._getType() === "human" ? "user" : "assistant",
            content: msg.content,
          };
        }
        return {
          role: "user",
          content: String(msg),
        };
      });

      const response = await client.invoke(formattedMessages);
      
      // Return in LangChain format
      return {
        content: response.content,
        _getType() { return "ai"; },
      };
    },
    
    // Add bindTools method for compatibility
    bindTools(tools: any[]) {
      console.warn("Tools not supported in direct OpenRouter implementation");
      return this;
    },
  };
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