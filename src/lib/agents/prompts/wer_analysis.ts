// Agentic prompts for WER-focused transcript analysis
// Uses intelligent tool requesting for evidence-based corrections

export const WER_AGENTIC_ANALYSIS_PROMPT = `You are analyzing a transcript for Word Error Rate (WER) improvement using an agentic approach. You can request tools to help validate corrections before making final decisions.

TRANSCRIPT SUMMARY:
{summary}

SEGMENTS TO ANALYZE:
{segmentsText}

NOTE: Each segment has precise timing metadata (startTime/endTime in seconds) for targeted analysis.

AVAILABLE TOOLS:

1. **phoneticAnalyzer**: Check if two words sound similar (homophones)
   Parameters: {"text": "original word", "candidate": "suggested replacement"}
   Use for: Suspected homophone corrections like "see" vs "sea"

2. **signalQualityAssessor**: Assess audio quality for a segment time range
   Parameters: {"startTime": 45.2, "endTime": 48.1}
   Use for: When correction confidence depends on audio clarity

3. **webSearch**: Search for information about unfamiliar terms
   Parameters: {"query": "search term", "language": "et"}
   Use for: Proper nouns, technical terms, domain-specific vocabulary

4. **asrAlternatives**: Get additional N-best ASR alternatives for a segment
   Parameters: {"segmentIndex": 5}
   Use for: When transcript quality is uncertain and alternatives might help

AGENTIC WORKFLOW:
1. First, analyze segments and identify potential corrections
2. If you need tool validation, request tools with specific parameters
3. After reviewing tool results, provide final corrections

RESPONSE FORMAT:

If you need tools, respond with:
{
  "reasoning": "Brief explanation of what you're analyzing",
  "toolRequests": [
    {
      "tool": "phoneticAnalyzer",
      "params": {
        "text": "original word",
        "candidate": "replacement word"
      }
    }
  ],
  "needsMoreAnalysis": true,
  "corrections": []
}

For final corrections (after tool analysis or if no tools needed):
{
  "reasoning": "Brief explanation of correction decisions", 
  "toolRequests": [],
  "needsMoreAnalysis": false,
  "corrections": [
    {
      "id": "c1",
      "original": "exact text to replace",
      "replacement": "corrected text", 
      "confidence": 0.85
    }
  ]
}

IMPORTANT:
- Only suggest corrections you are confident about (confidence > 0.7)
- Keep corrections SHORT and FOCUSED (1-5 words typically)
- NEVER include speaker names/tags in "original" or "replacement" fields
- Use tools strategically - focus on 1-3 most critical corrections per block
- Be explicit about your reasoning for requesting tools

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
	AGENTIC_ANALYSIS_PROMPT: string;
	CLARIFICATION_PROMPT: string;
}

export const WER_PROMPTS: WERPrompts = {
	AGENTIC_ANALYSIS_PROMPT: WER_AGENTIC_ANALYSIS_PROMPT,
	CLARIFICATION_PROMPT: WER_CLARIFICATION_PROMPT
};
