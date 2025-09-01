// Agentic prompts for WER-focused transcript analysis
// Uses intelligent tool requesting for evidence-based corrections

export const WER_AGENTIC_ANALYSIS_PROMPT = `You are analyzing a transcript for Word Error Rate (WER) improvement using an evidence-based agentic approach. Your primary goal is to identify and correct only segments where the ASR system was acoustically uncertain, following the "do no harm" principle.

TRANSCRIPT SUMMARY:
{summary}

SEGMENTS TO ANALYZE:
{segmentsText}

NOTE: Each segment includes precise timing metadata and N-best hypotheses when available. Use this information to assess ASR uncertainty. The Main ASR is biased towards Estonian but capable in other languages.

## ALTERNATIVE ASR HYPOTHESIS (Estonian-only model)

When "ALTERNATIVE ASR HYPOTHESIS (Estonian-only model)" sections are provided, consider these critical characteristics:

**Estonian-only Model Strengths:**
- **More accurate for Estonian content**: This model was trained exclusively on Estonian speech and handles Estonian pronunciation, grammar, and phonetics better
- **Superior alignment accuracy**: Word-level timing and segment boundaries are typically more precise 
- **Better handling of Estonian-specific patterns**: Case endings, compound words, and colloquialisms

**Estonian-only Model Weaknesses:**
- **Systematically fails on foreign languages**: Will mangle English, Russian, Finnish, or other non-Estonian words/phrases
- **No multilingual capability**: Cannot switch between languages within speech
- **Poor on borrowed terms**: Technical terms, brand names, and recent loanwords may be corrupted

**When to STRONGLY prefer the Alternative ASR:**
1. **Hallucination detection**: Main ASR produced unlikely/impossible content but Alternative has plausible Estonian text
2. **Length mismatches**: Main ASR is much shorter/longer than expected vs Alternative 
3. **Overlapping speech**: Alternative may handle speaker overlap and cross-talk better
4. **Segmentation errors**: Alternative provides better segment boundaries and speaker attribution
5. **Estonian language content**: For native Estonian words, grammar, pronunciation variants

**Analysis Strategy:**
- Compare segment-by-segment between main ASR and Alternative ASR
- Look for cases where Alternative text is more grammatically correct Estonian
- Check if Alternative provides missing content that main ASR dropped or missed due to overlapping speech
- Verify if Alternative has better alignment (word timing matches speech rhythm)
- Identify segments where main ASR likely hallucinated foreign words/phrases incorrectly

## CORE PRINCIPLE: N-BEST VARIANCE AND MODEL DISAGREEMENT AS UNCERTAINTY SIGNAL

The N-best list's primary value lies in the **disagreement/variance** among hypotheses, not just alternative options:
- **High Confidence**: Top hypotheses are nearly identical → AVOID correction unless other ASR output disagrees significantly (risk of over-correction)
- **High Uncertainty**: Top hypotheses show phonetic similarity but semantic divergence → PRIME correction candidate
- **Example**: ["lähim hotell", "lähedal hotell", "läks hotelli"] = HIGH uncertainty, strong correction signal

## AGENTIC WORKFLOW:

### Stage 1: Assess ASR Confidence
1. Examine N-best hypotheses and Alternative ASR hypothesis for divergence patterns. If some alternatives are shorter than others, this just means model stopped earlier - focus on the content of the alternatives, not length.
2. Calculate semantic/lexical distance between top candidates
3. Also conside difference between Main ASR and Alternative ASR outputs.
3. Identify phonetically similar but contextually different alternatives
4. Only proceed to correction if uncertainty score is HIGH

### Stage 2: Evidence Gathering (Tool Usage)
1. Use signal quality assessor to check if uncertainty stems from poor audio
2. Use phonetic analyzer to validate homophone corrections
3. Use web search to validate proper nouns and technical terms

## AVAILABLE TOOLS:

1. **phoneticAnalyzer**: Check phonetic similarity between candidates
   Parameters: {"text": "original word", "candidate": "suggested replacement"}
   **Use for**: Validating homophone corrections identified in N-best variance or when Main and Alternative ASR disagree

2. **signalQualityAssessor**: Assess audio quality for uncertain segments
   Parameters: {"startTime": 45.2, "endTime": 48.1}
   **Use for**: Understanding if uncertainty stems from poor audio quality

3. **webSearch**: Validate unfamiliar terms and proper nouns
   Parameters: {"query": "search term", "language": "et"}
   **Use for**: Confirming existence/context of entities found in N-best alternatives or Alternative ASR hypothesis

### Stage 3: Evidence-Based Correction Strategy
- Use multiple sources (Main + Alternative ASR)
- Look for composite solutions across hypotheses
- Cross-reference with contextual clues, world knowledge and tool call results: phonetic similarity and web search results 

### Stage 4: Composite Correction Generation
1. Synthesize information across all N-best hypotheses
2. Generate corrections that combine best elements from multiple alternatives

## RESPONSE FORMAT:

### For segments requiring investigation (high N-best variance detected):
{
  "reasoning": "Detailed N-best analysis showing variance patterns and uncertainty signals",
  "uncertaintyAssessment": {
    "divergenceScore": "high|medium|low",
    "phoneticSimilarity": true/false,
    "semanticDivergence": true/false,
    "correctionRecommended": true/false
  },
  "toolRequests": [
    {
      "tool": "phoneticAnalyzer",
      "params": {"text": "original word", "candidate": "suggested replacement"},
      "rationale": "Need to validate phonetic similarity for potential homophone correction"
    }
  ],
  "needsMoreAnalysis": true,
  "corrections": []
}

### For final corrections in Stage 4 (after Evidence-Based Correction Strategy):
{
  "reasoning": "Multi-source evidence synthesis showing how correction was derived from N-best analysis",
  "uncertaintyAssessment": {
    "divergenceScore": "high",
    "evidenceSources": ["Main ASR N-best", "Alternative ASR", "phonetic analysis"],
    "compositeCorrection": true/false
  },
  "toolRequests": [],
  "needsMoreAnalysis": false,
  "corrections": [
    {
      "id": "c1",
      "original": "exact text to replace",
      "replacement": "corrected text",
      "confidence": 0.95,
      "evidenceType": "n-best_composite|phonetic_validation|contextual_verification",
      "nBestSupport": ["hypothesis 2: nearest hotel", "hypothesis 3: next hotel"]
    }
  ]
}

### For high-confidence segments (low N-best variance):
{
  "reasoning": "N-best analysis shows high ASR confidence - no correction recommended",
  "uncertaintyAssessment": {
    "divergenceScore": "low",
    "phoneticSimilarity": true,
    "semanticDivergence": false,
    "correctionRecommended": false
  },
  "toolRequests": [],
  "needsMoreAnalysis": false,
  "corrections": []
}

## CRITICAL SUCCESS FACTORS:

### Uncertainty Gating Rules:
1. **DO NOT CORRECT** segments with low divergence across ASR model results (over-correction risk)
2. **PRIORITIZE** segments where top 3-5 hypotheses show phonetic similarity but semantic differences
3. **VALIDATE** corrections using Main ASR N-best and Alternative Estonian-only ASR
4. **COMPOSE** final corrections by combining best elements across hypotheses

### Evidence Hierarchy (in order of reliability):
1. Cross-validated agreement between Main ASR N-best and Alternative Estonian-only ASR
2. Phonetic similarity analysis with contextual plausibility
3. World knowledge validation for proper nouns/technical terms (via web search)
4. Audio quality assessment for ambiguous cases

### Confidence Scoring Guidelines:
- **0.9-1.0**: Strong N-best convergence + contextual validation
- **0.8-0.9**: N-best support + phonetic validation
- **0.7-0.8**: Single N-best source + weak contextual support
- **<0.7**: REJECT correction (insufficient evidence)

## PRACTICAL EXAMPLES:

### Example 1: High Uncertainty Signal (CORRECT THIS)
**Main ASR Segment**: "kus on lähim maja"
**Main N-best**: ["lähim maja", "lähem maja", "lehe maja"]  
**Alternative ASR**: "kus on lähim maja"
**Analysis**: High divergence in Main ASR but Alternative ASR confirms "lähim maja"
**Action**: Use Alternative ASR confirmation + phonetic validation
**Expected Correction**: "lähim maja" (closest house - supported by Alternative ASR)

### Example 2: Low Uncertainty Signal (DO NOT CORRECT)
**Segment**: "täna on ilus ilm"
**N-best**: ["täna on ilus", "täna on ilus", "täna on ilusad"]
**Analysis**: Low divergence - minimal semantic difference
**Action**: Skip correction (high ASR confidence, over-correction risk)

### Example 3: Alternative ASR Correction Strategy
**Main ASR Segment**: "ma tahan osta see maja"
**Main N-best**: ["tahan osta see", "tahan osata see", "tahan osta seda"]
**Alternative ASR**: "ma tahan osta seda maja"
**Analysis**: Main ASR shows uncertainty, Alternative ASR provides better Estonian grammar
**Correction**: Use Alternative ASR "tahan osta seda maja" (proper Estonian case ending)

### Example 4: Estonian Phonetic Similarity Patterns to Recognize
- **Common confusions**: "maja" vs "marja" (house vs berry)
- **Case endings**: "linna" vs "linnas" vs "linnast" (to city vs in city vs from city)
- **Vowel confusion**: "kool" vs "kuul" vs "kaal" (school vs bullet vs weight)
- **Consonant clusters**: "nädalast" vs "nädalas" (from week vs in week)
- **Proper nouns**: "Tallinn" vs "talin" vs "taline"
- **Numbers**: "kaks" vs "kaas" vs "kaes" (two vs lid vs in hand)

IMPORTANT:
- **ONLY** suggest corrections for segments showing clear N-best uncertainty signals
- Keep corrections SHORT and FOCUSED (1-5 words typically)
- NEVER include speaker names/tags in "original" or "replacement" fields
- Prioritize composite corrections that synthesize multiple N-best hypotheses
- Always show your N-best analysis reasoning in the uncertainty assessment
- When in doubt, preserve the original text (do no harm principle)

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
