// Legacy prompts from the original coordinationAgent implementation
// Includes ASR N-best functionality for secondary ASR model

export const LEGACY_SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert transcript analyst specializing in Estonian language.

Context from full transcript summary:
{summary}

Current speaker segment to analyze (speaker turn {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds
Word count: {wordCount} words

ASR N-best list: {alternativesSection}

This is a complete speaker turn - analyze the entire utterance from {speaker}.

Your task (REMEMBER: respond only in {responseLanguage}):
1. Analyze this complete speaker turn for quality, accuracy, and coherence
2. Consider the context from the full transcript summary
3. Identify potential transcription errors or unclear passages within this speaker's utterance
4. Provide specific improvement suggestions for this speaker's turn. Do not suggest speaker labeling changes
5. Determine if secondary ASR analysis would be helpful for unclear or potentially incorrect segments

Focus on:
- Grammar and language correctness throughout the speaker's turn
- Internal coherence within this speaker's utterance
- Consistency with the overall transcript context
- Proper nouns and technical terms accuracy
- Natural speech patterns
- Punctuation and formatting
- Phonetic plausibility of words (especially for potential homophones or ASR errors)
- Whether unclear segments would benefit from ASR N-best alternatives

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText and suggestedText SHORT and FOCUSED (typically 1-5 words, maximum 1-2 sentences)
- Target only the specific problematic part, not entire sentences or paragraphs
- Focus on the minimal text span that needs correction
- Avoid copying large portions of text - be precise and concise
- NEVER include speaker names or tags (like 'SPEAKER_01:', 'Speaker:') in originalText or suggestedText fields
- Only include the actual spoken words, not formatting or metadata

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks. Just the raw JSON object.

Provide a detailed analysis with actionable suggestions in exactly this JSON format:
{
  "analysis": "Your detailed analysis of this speaker's complete turn",
  "confidence": 0.85,
  "needsAlternatives": true,
  "needsWebSearch": [],
  "suggestions": [
    {
      "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "low|medium|high",
      "text": "Description of the issue",
      "originalText": "SHORT exact problematic text from the segment (1-5 words typically)",
      "suggestedText": "SHORT corrected text to replace it with (1-5 words typically)",
      "confidence": 0.9
    }
  ]
}

Remember: Return ONLY the JSON object above with your analysis. Nothing else.`;

export const LEGACY_ENHANCED_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert transcript analyst. You have already performed an initial analysis of a transcript segment.
Now you have access to additional ASR (Automatic Speech Recognition) alternative transcriptions from a different model that provides additional hypothesis.

Original transcript segment:
{originalText}

Your initial analysis identified these potential issues:
{initialAnalysis}

Alternative transcriptions from different ASR model (ranked by confidence):
{asrAlternatives}

CRITICAL INSIGHTS ABOUT THE ALTERNATIVE ASR MODEL:
- This alternative ASR model provides different transcription hypotheses from the main model
- Both the main model and this alternative model now return n-best lists, so this is not the only source of alternatives
- The main value from this alternative model is getting completely different recognition hypotheses
- Focus on identifying unique words or phrases that were NOT recognized by the original model
- Look for words/hints that only appear in the alternative model's output

Based on these ASR alternatives, please (REMEMBER: respond only in {responseLanguage}):
1. FOCUS PRIMARILY on unique words or phrases that appear ONLY in the alternative ASR results
2. Investigate words/hints that the original model completely missed or misrecognized
3. Pay special attention to segments where the alternative model provides completely different word choices
4. Look for technical terms, proper nouns, or specific vocabulary that only the alternative model captured
5. Identify cases where the alternative model provides clarity for unclear or garbled segments

Create new suggestions that emphasize unique insights from the alternative model. For each suggestion:
- Set originalText to the problematic segment from the original (keep SHORT - typically 1-5 words)
- Set suggestedText to the alternative when it provides unique words/hints not in the original (keep SHORT)
- Explain why the alternative provides valuable new information (focus on unique words/phrases)
- Set higher confidence when the alternative reveals completely different word choices that make more sense

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText and suggestedText SHORT and FOCUSED (typically 1-5 words, maximum 1-2 sentences)
- Target only the specific problematic part, not entire sentences or paragraphs
- Focus on the minimal text span that needs correction
- Avoid copying large portions of text - be precise and concise
- NEVER include speaker names or tags (like 'SPEAKER_01:', 'Speaker:') in originalText or suggestedText fields
- Only include the actual spoken words, not formatting or metadata

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

IMPORTANT: 
- Put MORE EMPHASIS on words/hints that are unique to the alternative model
- Investigate segments where the two models produced completely different results
- Focus on unique vocabulary, names, or technical terms only captured by the alternative
- Write every word of your analysis and suggestions in {responseLanguage}

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.
Do NOT include markdown code blocks, notes, or any other text. Just the raw JSON object.

Return your enhanced analysis in exactly this format:
{
  "analysis": "Your enhanced analysis incorporating ASR alternatives",
  "confidence": 0.85,
  "needsAlternatives": false,
  "needsWebSearch": [],
  "suggestions": [
    {
      "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "low|medium|high",
      "text": "Description of the issue with explanation of why ASR alternative is better",
      "originalText": "SHORT exact text from original transcript (1-5 words typically)",
      "suggestedText": "SHORT better alternative from ASR or your correction (1-5 words typically)",
      "confidence": 0.9,
      "explanation": "Optional: why the ASR alternative is more accurate"
    }
  ]
}

Remember: Return ONLY the JSON object. No other text whatsoever.`;
