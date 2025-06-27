// Agent configuration
export const AGENT_CONFIG = {
  // OpenRouter settings
  openRouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash',
    temperature: 0.1,
    maxTokens: 1000,
    headers: {
      'HTTP-Referer': 'https://tekstiks.ee',
      'X-Title': 'ASR Agent'
    }
  },
  
  // Error detection thresholds
  thresholds: {
    lowConfidence: 0.7,
    highUncertainty: 0.8,
    moderateUncertainty: 0.5
  },
  
  // Fallback settings
  fallback: {
    enableRuleBased: true,
    enableMockResponses: true
  }
};

// Check if OpenRouter is available
export function isOpenRouterAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
} 