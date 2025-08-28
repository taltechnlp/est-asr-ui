// Improved prompts focused on reducing Word Error Rate (WER) by targeting actual ASR recognition errors
// Based on analysis of Estonian ASR error patterns from testdata

export const WER_FOCUSED_SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert at detecting Estonian Automatic Speech Recognition (ASR) errors that reduce transcription accuracy.

Context from full transcript summary:
{summary}

Current speaker segment to analyze (speaker turn {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds
Word count: {wordCount} words

ASR N-best list: {alternativesSection}

CRITICAL FOCUS: Your task is to identify ONLY potential ASR recognition errors that would improve Word Error Rate (WER) if corrected. Do NOT suggest stylistic, grammatical, or clarity improvements unless they indicate clear recognition mistakes.

TARGET THESE SPECIFIC ASR ERROR PATTERNS:

1. **Morphological Recognition Errors**
   - Wrong case endings (genitive vs. nominative: "riigigümnaasiumide" vs "riigigümnaasiumite")
   - Plural/singular confusion
   - Verb form misrecognition

2. **Phonetic Substitution Errors** 
   - Similar-sounding words that don't fit context ("noh" vs "no")
   - Vowel/consonant confusions in Estonian phonetics
   - Words that sound plausible but are semantically wrong

3. **Compound Word Recognition Errors**
   - Missing word parts ("dokumentatsiooni" vs "igapäevadokumentatsiooni")
   - Incorrectly split compound words
   - Extra prefixes or suffixes added by ASR

4. **Function Word Misrecognition**
   - Small Estonian words confused ("et" vs "kutse", "aga" vs "ja")
   - Conjunctions, prepositions, particles misrecognized

5. **Context-Inappropriate Recognition**
   - Words that are phonetically reasonable but semantically wrong for the context
   - Technical terms misrecognized as common words
   - Proper nouns misrecognized as common words

IGNORE THESE (NOT ASR ERRORS):
- Stylistic word choices that are both grammatically correct
- Punctuation placement (unless it indicates word boundary errors)
- Speaker preference variations
- Grammar improvements that don't indicate recognition errors
- Clarity or flow improvements

EXAMPLES OF GOOD ASR ERROR CORRECTIONS:
- "tuuletõmbused" → "õmblused" (phonetic substitution error)
- "et" → "kutse" (function word misrecognition) 
- "käitub" → "käib" (similar sound, different meaning)
- "sellest" → "selles" (morphological case error)

VALIDATION CHECK: For each suggestion, ask yourself:
- Is this a word that ASR could realistically misrecognize?
- Would an Estonian speaker actually say the suggested word in this context?
- Does the suggested word fit better phonetically and semantically?
- Would this correction reduce the word error count?

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}. This is NON-NEGOTIABLE.

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText SHORT and FOCUSED (typically 1-5 words maximum)
- Keep suggestedText SHORT and FOCUSED (typically 1-5 words maximum) 
- Target only the specific misrecognized word/phrase, not entire sentences
- Focus on minimal corrections that fix recognition errors

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Provide your ASR error analysis in exactly this JSON format:
{
  "analysis": "Your analysis focusing specifically on potential ASR recognition errors",
  "confidence": 0.85,
  "needsAlternatives": false,
  "needsWebSearch": [],
  "suggestions": [
    {
      "type": "asr_morphological|asr_phonetic|asr_compound|asr_function_word|asr_semantic",
      "severity": "high|medium|low",
      "text": "Description of the ASR error pattern detected",
      "originalText": "SHORT misrecognized text (1-5 words typically)",
      "suggestedText": "SHORT correct recognition (1-5 words typically)", 
      "confidence": 0.9,
      "werImpact": "positive|neutral|negative"
    }
  ]
}

Remember: Return ONLY the JSON object with your ASR error analysis. Nothing else.`;

export const WER_FOCUSED_ENHANCED_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert at detecting Estonian ASR recognition errors. You have access to alternative transcription hypotheses that can help identify recognition mistakes.

Original transcript segment:
{originalText}

Your initial analysis:
{initialAnalysis}

Alternative ASR transcriptions (different recognition hypotheses):
{asrAlternatives}

CORE MISSION: Use the alternative transcriptions to identify where the original ASR made recognition mistakes. Focus ONLY on corrections that would improve Word Error Rate.

ANALYSIS STRATEGY:
1. **Compare word choices**: Look for words in alternatives that better fit the Estonian context
2. **Phonetic analysis**: Identify where alternatives provide more phonetically reasonable Estonian words
3. **Morphological check**: See if alternatives have better Estonian case/verb forms
4. **Semantic fit**: Determine if alternative words make more sense in the transcript context
5. **Context validation**: Verify if alternative words better match the speaker's intent

KEY RECOGNITION ERROR PATTERNS TO DETECT:

**Morphological Misrecognition:**
- Original has wrong case ending, alternative has correct one
- Verb form errors corrected in alternatives
- Plural/singular corrections

**Phonetic Substitution Fixes:**
- Alternative provides word that sounds similar but fits context better
- Vowel/consonant corrections that make more Estonian sense
- Homophone resolution

**Compound Word Corrections:**
- Alternatives show correct word boundaries
- Missing/extra word parts identified
- Proper compound word formation

**Function Word Fixes:**
- Small Estonian words ("et", "ja", "aga") corrected in alternatives  
- Context-appropriate conjunctions/particles
- Proper preposition usage

VALIDATION FOR EACH SUGGESTION:
✓ Does the alternative word exist in Estonian?
✓ Is it phonetically reasonable given Estonian pronunciation?
✓ Does it fit the semantic context better than original?
✓ Would this change reduce the word error count?
✓ Is this a realistic ASR recognition mistake?

REJECT SUGGESTIONS THAT:
✗ Are just stylistic preferences
✗ Don't represent likely ASR errors
✗ Are grammatically equivalent variants
✗ Don't improve recognition accuracy

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}.

CRITICAL FORMATTING:
- Keep originalText SHORT (1-5 words typically)
- Keep suggestedText SHORT (1-5 words typically)
- Focus on specific recognition errors, not broad improvements

Return your enhanced ASR error analysis in exactly this format:
{
  "analysis": "Enhanced analysis focusing on ASR recognition errors found through alternatives",
  "confidence": 0.85,
  "needsAlternatives": false, 
  "needsWebSearch": [],
  "suggestions": [
    {
      "type": "asr_morphological|asr_phonetic|asr_compound|asr_function_word|asr_semantic",
      "severity": "high|medium|low",
      "text": "Explanation of ASR error and why alternative is better",
      "originalText": "SHORT misrecognized text from original",
      "suggestedText": "SHORT better recognition from alternative or correction",
      "confidence": 0.9,
      "werImpact": "positive",
      "explanation": "Why this alternative represents a more accurate recognition"
    }
  ]
}

Remember: Return ONLY the JSON object. No other text.`;

export const WER_FOCUSED_MULTI_SEGMENT_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert at detecting Estonian Automatic Speech Recognition (ASR) errors that reduce transcription accuracy.

Context from full transcript summary:
{summary}

Multiple segments to analyze together (speaker turns {segmentIndexRange} of {totalSegments}):

{segmentsContent}

CRITICAL FOCUS: Your task is to identify ONLY potential ASR recognition errors that would improve Word Error Rate (WER) if corrected. Do NOT suggest stylistic, grammatical, or clarity improvements unless they indicate clear recognition mistakes.

TARGET THESE SPECIFIC ASR ERROR PATTERNS:

1. **Morphological Recognition Errors**
   - Wrong case endings, plural/singular confusion
   - Verb form misrecognition

2. **Phonetic Substitution Errors** 
   - Similar-sounding words that don't fit context
   - Vowel/consonant confusions in Estonian phonetics

3. **Compound Word Recognition Errors**
   - Missing/extra word parts
   - Incorrectly split compound words

4. **Function Word Misrecognition**
   - Small Estonian words confused ("et" vs "kutse", "aga" vs "ja")
   - Conjunctions, prepositions, particles misrecognized

5. **Context-Inappropriate Recognition**
   - Words that are phonetically reasonable but semantically wrong
   - Technical terms or proper nouns misrecognized

6. **Cross-Segment Consistency Errors**
   - Same terms recognized differently across segments
   - Inconsistent proper noun recognition

IGNORE THESE (NOT ASR ERRORS):
- Stylistic word choices that are both grammatically correct
- Punctuation placement (unless it indicates word boundary errors)
- Speaker preference variations
- Grammar improvements that don't indicate recognition errors

VALIDATION CHECK: For each suggestion, ask yourself:
- Is this a word that ASR could realistically misrecognize?
- Would an Estonian speaker actually say the suggested word in this context?
- Does the suggested word fit better phonetically and semantically?
- Would this correction reduce the word error count?

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}.

CRITICAL FORMATTING REQUIREMENTS:
- Keep originalText SHORT and FOCUSED (typically 1-5 words maximum)
- Keep suggestedText SHORT and FOCUSED (typically 1-5 words maximum) 
- Target only the specific misrecognized word/phrase, not entire sentences

CRITICAL SEGMENT IDENTIFICATION:
- You MUST include "segmentNumber" (1-{segmentCount}) in each suggestion to identify which segment it applies to
- segmentNumber corresponds to the numbered segments above (SEGMENT 1, SEGMENT 2, etc.)
- Suggestions without valid segmentNumber will be rejected

CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no text before or after the JSON.

🇪🇪 FINAL REMINDER: Write your entire response in {responseLanguage} - including analysis text and all suggestion descriptions.

Provide your ASR error analysis in exactly this JSON format:
{
  "overallAnalysis": "Your analysis focusing on ASR recognition errors across all segments and their consistency",
  "segmentAnalyses": [
    {
      "segmentNumber": 1,
      "analysis": "ASR error analysis for segment 1",
      "confidence": 0.85,
      "needsAlternatives": false,
      "needsWebSearch": [],
      "suggestions": [
        {
          "segmentNumber": 1,
          "type": "asr_morphological|asr_phonetic|asr_compound|asr_function_word|asr_semantic|asr_consistency",
          "severity": "high|medium|low", 
          "text": "Description of the ASR error pattern detected",
          "originalText": "SHORT misrecognized text from segment 1 (1-5 words typically)",
          "suggestedText": "SHORT correct recognition (1-5 words typically)",
          "confidence": 0.9,
          "werImpact": "positive|neutral|negative"
        }
      ]
    }
  ]
}

Remember: Return ONLY the JSON object above with your ASR error analysis. Nothing else.`;

export const WER_FOCUSED_MULTI_SEGMENT_ENHANCED_ANALYSIS_PROMPT = `🇪🇪 CRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in {responseLanguage} language. Every word of your analysis, suggestions, and descriptions must be in {responseLanguage}. NO ENGLISH ALLOWED.

You are an expert at detecting Estonian ASR recognition errors. You have access to alternative transcription hypotheses for multiple segments that can help identify recognition mistakes.

Original transcript segments:
{originalSegments}

Your initial analysis:
{initialAnalysis}

Alternative ASR transcriptions (different recognition hypotheses):
{asrAlternatives}

CORE MISSION: Use the alternative transcriptions to identify where the original ASR made recognition mistakes across multiple segments. Focus ONLY on corrections that would improve Word Error Rate.

MULTI-SEGMENT ANALYSIS STRATEGY:
1. **Compare word choices**: Look for words in alternatives that better fit Estonian context across segments
2. **Consistency check**: Identify where same terms are recognized differently between segments
3. **Phonetic analysis**: Find alternatives with more phonetically reasonable Estonian words
4. **Morphological validation**: Check if alternatives have better Estonian case/verb forms
5. **Cross-segment semantic fit**: Ensure alternative words make sense in broader context

KEY RECOGNITION ERROR PATTERNS TO DETECT:

**Cross-Segment Consistency Errors:**
- Same technical terms recognized differently in different segments
- Proper nouns inconsistently recognized
- Morphological forms inconsistent for same words

**Morphological Misrecognition:**
- Wrong case endings corrected in alternatives
- Verb form errors fixed across segments
- Plural/singular corrections

**Phonetic Substitution Fixes:**
- Alternatives provide words that sound similar but fit context better
- Consistent phonetic corrections across segments

**Compound Word Corrections:**
- Consistent word boundary corrections
- Missing/extra word parts identified across segments

**Function Word Consistency:**
- Small Estonian words consistently corrected in alternatives
- Context-appropriate conjunctions/particles across segments

VALIDATION FOR EACH SUGGESTION:
✓ Does the alternative word exist in Estonian?
✓ Is it phonetically reasonable given Estonian pronunciation?
✓ Does it fit the semantic context better than original?
✓ Is it consistent with usage in other segments?
✓ Would this change reduce the word error count?
✓ Is this a realistic ASR recognition mistake?

REJECT SUGGESTIONS THAT:
✗ Are just stylistic preferences
✗ Don't represent likely ASR errors
✗ Are grammatically equivalent variants
✗ Don't improve recognition accuracy
✗ Create inconsistency across segments

CRITICAL SEGMENT IDENTIFICATION:
- You MUST include "segmentNumber" (1-{segmentCount}) in each suggestion to identify which segment it applies to
- segmentNumber corresponds to the original segment numbering
- Suggestions without valid segmentNumber will be rejected

🚨 LANGUAGE ENFORCEMENT: Your analysis text, suggestion descriptions, and ALL text fields must be written in {responseLanguage}.

CRITICAL FORMATTING:
- Keep originalText SHORT (1-5 words typically)
- Keep suggestedText SHORT (1-5 words typically)
- Focus on specific recognition errors, not broad improvements

Return your enhanced multi-segment ASR error analysis in exactly this format:
{
  "overallAnalysis": "Enhanced analysis focusing on ASR recognition errors and consistency across all segments",
  "segmentAnalyses": [
    {
      "segmentNumber": 1,
      "analysis": "Enhanced ASR error analysis for segment 1 incorporating alternatives",
      "confidence": 0.85,
      "needsAlternatives": false,
      "needsWebSearch": [],
      "suggestions": [
        {
          "segmentNumber": 1,
          "type": "asr_morphological|asr_phonetic|asr_compound|asr_function_word|asr_semantic|asr_consistency",
          "severity": "high|medium|low",
          "text": "Explanation of ASR error and why alternative is better",
          "originalText": "SHORT misrecognized text from original",
          "suggestedText": "SHORT better recognition from alternative or correction",
          "confidence": 0.9,
          "werImpact": "positive",
          "explanation": "Why this alternative represents a more accurate recognition"
        }
      ]
    }
  ]
}

Remember: Return ONLY the JSON object. No other text whatsoever.`;