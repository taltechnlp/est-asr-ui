// Direct analysis prompts without secondary ASR N-best alternatives
// Focus on primary transcript analysis using other available tools

export const NO_SECONDARY_ASR_SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert at analyzing Estonian transcripts for accuracy and quality issues.

Context from full transcript summary:
{summary}

Current speaker segment to analyze (speaker turn {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds
Word count: {wordCount} words

Signal Quality: {signalQualitySection}
Phonetic Analysis: {phoneticSection}

CRITICAL FOCUS: Analyze the transcript segment for potential errors and improvements that would enhance accuracy and understanding.

TARGET THESE ANALYSIS AREAS:

1. **Estonian Language Accuracy**
   - Morphological correctness (case endings, verb forms)
   - Proper word usage and context appropriateness
   - Compound word structure and completeness

2. **Contextual Consistency** 
   - Words that don't fit the semantic context
   - Technical terms that may be misunderstood
   - Proper nouns and specialized terminology

3. **Estonian Phonetic Patterns**
   - Words that may have phonetic alternatives more suitable for context
   - Estonian-specific sound patterns and their implications
   - Regional pronunciation considerations

4. **Semantic Coherence**
   - Logical flow and meaning within the segment
   - Context-appropriate word choices
   - Consistency with overall transcript theme

VALIDATION APPROACH:
- Consider if suggested changes improve accuracy and understanding
- Ensure suggestions maintain Estonian language authenticity
- Verify that corrections align with the speaker's apparent intent
- Focus on changes that would demonstrably improve the transcript

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText SHORT and FOCUSED (typically 1-5 words maximum)
- Keep suggestedText SHORT and FOCUSED (typically 1-5 words maximum) 
- Target specific words/phrases that need correction
- Focus on precise, targeted improvements

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Provide your analysis in exactly this JSON format:
{
  "analysis": "Your comprehensive analysis of potential accuracy issues in this Estonian transcript segment",
  "confidence": 0.85,
  "needsWebSearch": [],
  "correctedSegment": "The complete corrected text of this segment with all high-confidence improvements, maintaining original speaker style and natural flow",
  "suggestions": [
    {
      "type": "morphological|phonetic|compound|semantic|contextual",
      "severity": "high|medium|low",
      "text": "Description of the issue detected and rationale for correction",
      "originalText": "SHORT text to be corrected (1-5 words typically)",
      "suggestedText": "SHORT corrected text (1-5 words typically)", 
      "confidence": 0.9,
      "impact": "positive|neutral|negative"
    }
  ]
}

Remember: Return ONLY the JSON object with your analysis. Nothing else.`;

export const NO_SECONDARY_ASR_MULTI_SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert at analyzing Estonian transcript segments for accuracy and consistency across multiple speaker turns.

Context from full transcript summary:
{summary}

Multiple speaker segments to analyze:
{segments}

Signal Quality Data: {signalQualitySection}
Phonetic Analysis: {phoneticSection}

CRITICAL FOCUS: Analyze these transcript segments for potential errors and consistency issues that would enhance overall accuracy.

MULTI-SEGMENT ANALYSIS AREAS:

1. **Cross-Segment Consistency**
   - Consistent terminology usage across segments
   - Speaker-specific language patterns and preferences
   - Topic coherence and logical progression

2. **Estonian Language Patterns**
   - Morphological consistency across related discussions
   - Proper case usage in connected discourse
   - Compound word consistency and completeness

3. **Contextual Flow Analysis**
   - Semantic connections between segments
   - Topic transitions and referential coherence
   - Technical term consistency

4. **Quality Assessment**
   - Overall transcript coherence
   - Potential misunderstandings or gaps
   - Areas requiring clarification or correction

VALIDATION STRATEGY:
- Ensure suggestions improve overall transcript quality
- Maintain consistency with Estonian language patterns
- Verify corrections support the discourse flow
- Focus on changes that enhance understanding

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Provide your analysis in exactly this JSON format:
{
  "overallAnalysis": "Your comprehensive analysis of accuracy and consistency issues across all segments",
  "results": [
    {
      "segmentIndex": 1,
      "analysis": "Analysis for segment 1",
      "confidence": 0.85,
      "needsWebSearch": [],
      "correctedSegment": "The complete corrected text of segment 1 with all high-confidence improvements",
      "suggestions": [
        {
          "type": "morphological|phonetic|compound|semantic|contextual|consistency",
          "severity": "high|medium|low",
          "text": "Description of the issue detected",
          "originalText": "SHORT text to be corrected (1-5 words typically)",
          "suggestedText": "SHORT corrected text (1-5 words typically)",
          "confidence": 0.9,
          "impact": "positive|neutral|negative"
        }
      ]
    }
  ]
}

Remember: Return ONLY the JSON object above with your analysis. Nothing else.`;

// Enhanced analysis is not needed for this strategy since it was specifically for ASR alternatives
export const NO_SECONDARY_ASR_ENHANCED_ANALYSIS_PROMPT = `This prompt is not used in the no_secondary_asr strategy.`;

export const NO_SECONDARY_ASR_MULTI_SEGMENT_ENHANCED_ANALYSIS_PROMPT = `This prompt is not used in the no_secondary_asr strategy.`;
