// Agentic prompts for WER-focused transcript analysis
// Uses intelligent tool requesting for evidence-based corrections

export const WER_AGENTIC_ANALYSIS_PROMPT = `You are analyzing a transcript for Word Error Rate (WER) improvement using an evidence-based agentic approach. Your primary goal is to identify and correct only segments where the ASR system was acoustically uncertain, following the "do no harm" principle.

TRANSCRIPT SUMMARY:
{summary}

SEGMENTS TO ANALYZE:
{segmentsText}

NOTE: Each segment includes precise timing metadata and N-best hypotheses when available. Use this information to assess ASR uncertainty.

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

## CORE PRINCIPLE: N-BEST VARIANCE AS UNCERTAINTY SIGNAL

The N-best list's primary value lies in the **disagreement/variance** among hypotheses, not just alternative options:
- **High Confidence**: Top hypotheses are nearly identical → AVOID correction (risk of over-correction)
- **High Uncertainty**: Top hypotheses show phonetic similarity but semantic divergence → PRIME correction candidate
- **Example**: ["nist hotel", "nearest hotel", "next hotel"] = HIGH uncertainty, strong correction signal

## UNCERTAINTY ESTIMATION FRAMEWORK

### Stage 1: Assess ASR Confidence
1. Examine N-best hypotheses for divergence patterns
2. Calculate semantic/lexical distance between top candidates
3. Identify phonetically similar but contextually different alternatives
4. Only proceed to correction if uncertainty score is HIGH

### Stage 2: Evidence-Based Correction Strategy
- Use multiple N-best sources (primary + secondary ASR via tools)
- Look for composite solutions across hypotheses
- Cross-reference with contextual clues and world knowledge

### Stage 3: Confidence Verification
- Validate corrections against multiple evidence sources
- Assign confidence scores based on evidence strength
- Reject low-confidence corrections to prevent degradation

## AVAILABLE TOOLS:

1. **asrAlternatives**: Get additional N-best ASR alternatives for uncertain segments (oftern only returns 1 or 2)
   Parameters: {"segmentIndex": 5}
   **PRIMARY USE**: For segments showing initial N-best disagreement or missing alternatives
   **Strategy**: Compare primary and secondary ASR N-best lists for cross-validation and hints of acoustic ambiguity

2. **phoneticAnalyzer**: Check phonetic similarity between candidates
   Parameters: {"text": "original word", "candidate": "suggested replacement"}
   **Use for**: Validating homophone corrections identified in N-best variance

3. **signalQualityAssessor**: Assess audio quality for uncertain segments
   Parameters: {"startTime": 45.2, "endTime": 48.1}
   **Use for**: Understanding if uncertainty stems from poor audio quality

4. **webSearch**: Validate unfamiliar terms and proper nouns
   Parameters: {"query": "search term", "language": "et"}
   **Use for**: Confirming existence/context of entities found in N-best alternatives

## AGENTIC WORKFLOW:

### Phase 1: Uncertainty Detection
1. Analyze existing N-best hypotheses for variance patterns
2. Identify segments with high acoustic ambiguity signals
3. Skip segments with high ASR confidence (similar top hypotheses)

### Phase 2: Evidence Gathering (Tool Usage)
1. Request additional N-best alternatives for uncertain segments
2. Cross-validate findings with phonetic/contextual tools
3. Build multi-source evidence case for proposed corrections

### Phase 3: Composite Correction Generation
1. Synthesize information across all N-best hypotheses
2. Generate corrections that combine best elements from multiple alternatives
3. Apply only high-confidence corrections (>0.8 confidence)

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
      "tool": "asrAlternatives",
      "params": {"segmentIndex": 5},
      "rationale": "Need secondary ASR N-best for cross-validation of acoustic ambiguity"
    }
  ],
  "needsMoreAnalysis": true,
  "corrections": []
}

### For final corrections (after evidence gathering):
{
  "reasoning": "Multi-source evidence synthesis showing how correction was derived from N-best analysis",
  "uncertaintyAssessment": {
    "divergenceScore": "high",
    "evidenceSources": ["primary N-best", "secondary ASR", "phonetic analysis"],
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
1. **DO NOT CORRECT** segments with low N-best divergence (over-correction risk)
2. **PRIORITIZE** segments where top 3-5 hypotheses show phonetic similarity but semantic differences
3. **VALIDATE** corrections using multiple N-best sources (primary + secondary ASR)
4. **COMPOSE** final corrections by combining best elements across hypotheses

### Evidence Hierarchy (in order of reliability):
1. Cross-validated N-best agreement (primary + secondary ASR)
2. Phonetic similarity analysis with contextual plausibility
3. World knowledge validation for proper nouns/technical terms
4. Audio quality assessment for ambiguous cases

### Confidence Scoring Guidelines:
- **0.9-1.0**: Strong N-best convergence + contextual validation
- **0.8-0.9**: N-best support + phonetic validation
- **0.7-0.8**: Single N-best source + weak contextual support
- **<0.7**: REJECT correction (insufficient evidence)

## PRACTICAL EXAMPLES:

### Example 1: High Uncertainty Signal (CORRECT THIS)
**Segment**: "kus on lähim maja"
**N-best**: ["lähim maja", "lähem maja", "lehe maja"]
**Analysis**: High divergence - phonetically similar but semantically different
**Action**: Request asrAlternatives for cross-validation
**Expected Correction**: "lähim maja" (closest house - most contextually plausible)

### Example 2: Low Uncertainty Signal (DO NOT CORRECT)
**Segment**: "täna on ilus ilm"
**N-best**: ["täna on ilus", "täna on ilus", "täna on ilusad"]
**Analysis**: Low divergence - minimal semantic difference
**Action**: Skip correction (high ASR confidence, over-correction risk)

### Example 3: Composite Correction Strategy
**Segment**: "ma tahan osta see maja"
**Primary N-best**: ["tahan osta see", "tahan osata see", "tahan osta seda"]
**Secondary N-best**: ["tahan osta seda", "tahan osta seda maja", "tahaksin osta seda"]
**Analysis**: Clear error pattern across multiple sources
**Correction**: Synthesize "tahan osta seda maja" from secondary validation

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
