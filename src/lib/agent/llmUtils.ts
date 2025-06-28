import OpenAI from 'openai';
import { AGENT_CONFIG, isOpenRouterAvailable } from './config';

// Helper function to clean and parse JSON from LLM responses
export function parseJsonFromLLM(content: string): any {
  // Strip markdown code blocks if present
  let cleanContent = content.trim();
  
  // Remove ```json or ``` blocks
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Remove any leading/trailing whitespace
  cleanContent = cleanContent.trim();
  
  // Parse the cleaned JSON
  return JSON.parse(cleanContent);
}

let openai: OpenAI | null = null;
if (isOpenRouterAvailable()) {
  openai = new OpenAI({
    baseURL: AGENT_CONFIG.openRouter.baseURL,
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: AGENT_CONFIG.openRouter.headers
  });
}

export async function analyzeSegmentWithOpenRouter(segmentText: string, nerResults: any): Promise<string> {
  if (!openai) throw new Error('OpenRouter not available');
  const prompt = `You are an expert ASR (Automatic Speech Recognition) transcript analyst specializing in Estonian language processing.\n\nAnalyze the following transcript segment and its NER (Named Entity Recognition) results to identify potential issues and suggest improvements.\n\nSEGMENT TEXT: ${segmentText}\n\nNER ANALYSIS RESULTS:\n${typeof nerResults === 'string' ? nerResults : JSON.stringify(nerResults, null, 2)}\n\nPlease analyze this segment and provide:\n\n1. Issues Identified: List any potential problems with the transcript segment\n2. Confidence Assessment: Rate the overall confidence as HIGH, MEDIUM, or LOW\n3. Key Concerns: Highlight the most important issues that need attention\n4. Context Analysis: Consider the surrounding context and entity relationships\n\nFocus on:\n- Named entity accuracy and consistency\n- Potential ASR misrecognitions\n- Grammatical or contextual issues\n- Missing or incorrect punctuation\n- Speaker attribution accuracy\n\nProvide your analysis in a clear, structured format.`;
  const response = await openai.chat.completions.create({
    model: AGENT_CONFIG.openRouter.model,
    messages: [
      { role: 'system', content: 'You are an expert ASR transcript analyst.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 512
  });
  return response.choices[0]?.message?.content || '';
}

export async function suggestCorrectionsWithOpenRouter(segmentText: string, nerResults: any, analysis: string): Promise<string> {
  if (!openai) throw new Error('OpenRouter not available');
  const prompt = `You are an expert Estonian language editor and ASR correction specialist.\n\nBased on the segment analysis, provide specific correction suggestions for the transcript segment.\n\nSEGMENT TEXT: ${segmentText}\n\nNER ANALYSIS:\n${typeof nerResults === 'string' ? nerResults : JSON.stringify(nerResults, null, 2)}\n\nPRELIMINARY ANALYSIS:\n${analysis}\n\nPlease provide specific correction suggestions in the following JSON format:\n\n{\n  "corrections": [\n    {\n      "original": "original text",\n      "suggested": "corrected text", \n      "confidence": 0.95,\n      "reasoning": "explanation for the correction",\n      "type": "entity|grammar|punctuation|context"\n    }\n  ],\n  "overallAssessment": "brief summary of the segment quality",\n  "priority": "high|medium|low"\n}\n\nFocus on:\n- Named entity corrections (proper nouns, organizations, locations)\n- Grammatical improvements\n- Punctuation fixes\n- Contextual clarifications\n- ASR-specific error patterns\n\nOnly suggest corrections you are confident about (confidence > 0.7).`;
  const response = await openai.chat.completions.create({
    model: AGENT_CONFIG.openRouter.model,
    messages: [
      { role: 'system', content: 'You are an expert Estonian language editor and ASR correction specialist.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 512
  });
  return response.choices[0]?.message?.content || '';
} 