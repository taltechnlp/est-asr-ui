// Simplified prompts for WER-focused transcript analysis
// Focused on correcting ASR errors without complex JSON structures

export const WER_BLOCK_ANALYSIS_PROMPT = `You are analyzing a transcript for Word Error Rate (WER) improvement. Focus on correcting obvious ASR (speech recognition) errors, not style or grammar issues.

TRANSCRIPT SUMMARY:
{summary}

SEGMENTS TO ANALYZE:
{segmentsText}

TASK:
Identify and correct clear ASR errors such as:
- Wrong words that sound similar (homophones)
- Missing or extra words due to poor audio quality  
- Incorrect punctuation that affects meaning
- Speaker name errors

TOOL USAGE STRATEGY:
- Use phoneticAnalyzer tool ONLY for suspected sound-alike errors (homophones)
- Focus tool usage on 1-3 most critical corrections per block
- Skip tool usage for obvious errors (typos, clear misspellings)
- Prioritize corrections that will have the biggest WER impact

IMPORTANT:
- Only suggest corrections you are confident about (confidence > 0.7)
- Keep speaker names and structure intact
- Focus on meaning-changing errors, not style preferences
- Each correction should have a unique ID
- Use exact text from the segments above for "original" field
- Be strategic with tool usage - don't analyze every word phonetically

Respond in JSON format:
{
  "corrections": [
    {
      "id": "c1", 
      "original": "exact text to replace",
      "replacement": "corrected text",
      "confidence": 0.85
    }
  ]
}

Response language: {responseLanguage}`;

export const WER_CLARIFICATION_PROMPT = `Multiple occurrences of "{originalText}" found in the text. Please provide more specific context to identify which occurrence should be replaced with "{replacementText}".

Text snippet:
{textSnippet}

Correction ID: {correctionId}
Original: "{originalText}"
Replacement: "{replacementText}"

Please respond with a JSON object containing:
{
  "specificText": "longer text snippet that uniquely identifies the occurrence to replace"
}

If you cannot be more specific, respond with:
{
  "specificText": null,
  "reason": "explanation why this correction should be skipped"
}`;

export interface WERPrompts {
	BLOCK_ANALYSIS_PROMPT: string;
	CLARIFICATION_PROMPT: string;
}

export const WER_PROMPTS: WERPrompts = {
	BLOCK_ANALYSIS_PROMPT: WER_BLOCK_ANALYSIS_PROMPT,
	CLARIFICATION_PROMPT: WER_CLARIFICATION_PROMPT
};
