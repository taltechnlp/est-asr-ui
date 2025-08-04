import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import type { ImprovementSuggestion } from "../schemas/transcript";

const ContextValidationSchema = z.object({
  text: z.string().describe("The full transcript text to validate"),
  language: z.enum(["et", "fi", "en"]).describe("Language of the text"),
  segments: z.array(z.object({
    id: z.string(),
    text: z.string(),
    start: z.number(),
    end: z.number(),
  })).optional().describe("Individual segments for detailed analysis"),
});

export class ContextValidatorTool extends TranscriptAnalysisTool {
  constructor() {
    super(
      "context_validator",
      "Validate context coherence and identify potential transcription errors based on semantic analysis",
      ContextValidationSchema,
      async ({ text, language, segments }) => {
        const suggestions: ImprovementSuggestion[] = [];
        
        // Common ASR errors for Estonian/Finnish
        const commonErrors: Record<string, { wrong: RegExp; correct: string; explanation: string }[]> = {
          et: [
            { wrong: /\btall\b/gi, correct: "tal", explanation: "Common ASR error: 'tall' (stable) vs 'tal' (he/she has)" },
            { wrong: /\bvõi\s+ma\b/gi, correct: "võima", explanation: "Should be 'võima' (to be able) not 'või ma' (or I)" },
            { wrong: /\bpole\s+mitte\b/gi, correct: "pole", explanation: "Double negative 'pole mitte' is redundant" },
            { wrong: /\bka\s+kui\b/gi, correct: "isegi kui", explanation: "Consider 'isegi kui' (even if) instead of 'ka kui'" },
          ],
          fi: [
            { wrong: /\bon\s+ko\b/gi, correct: "onko", explanation: "Question word should be 'onko' not 'on ko'" },
            { wrong: /\bei\s+kä\b/gi, correct: "eikä", explanation: "Should be 'eikä' (and not) not 'ei kä'" },
            { wrong: /\bmennä\b/gi, correct: "mennään", explanation: "Passive form should be 'mennään' not 'mennä'" },
          ],
          en: [
            { wrong: /\bshould\s+of\b/gi, correct: "should have", explanation: "Common error: 'should of' vs 'should have'" },
            { wrong: /\bcould\s+of\b/gi, correct: "could have", explanation: "Common error: 'could of' vs 'could have'" },
          ]
        };
        
        // Check for common ASR errors
        const errors = commonErrors[language] || [];
        errors.forEach(error => {
          let match;
          while ((match = error.wrong.exec(text)) !== null) {
            const startOffset = match.index;
            const endOffset = startOffset + match[0].length;
            
            suggestions.push({
              type: "context_error",
              severity: "medium",
              startOffset,
              endOffset,
              originalText: match[0],
              suggestedText: error.correct,
              explanation: error.explanation,
              confidence: 0.8,
            });
          }
        });
        
        // Check for semantic inconsistencies
        if (segments && segments.length > 1) {
          // Look for abrupt topic changes
          for (let i = 1; i < segments.length; i++) {
            const prevWords = segments[i - 1].text.toLowerCase().split(/\s+/);
            const currentWords = segments[i].text.toLowerCase().split(/\s+/);
            
            // Simple topic continuity check - count common words
            const commonWords = prevWords.filter(word => 
              word.length > 3 && currentWords.includes(word)
            ).length;
            
            const continuityScore = commonWords / Math.min(prevWords.length, currentWords.length);
            
            if (continuityScore < 0.1 && segments[i].text.length > 20) {
              suggestions.push({
                type: "context_error",
                severity: "low",
                segmentId: segments[i].id,
                originalText: segments[i].text.substring(0, 50) + "...",
                suggestedText: segments[i].text.substring(0, 50) + "...",
                explanation: "Abrupt topic change detected - verify segment boundary",
                confidence: 0.5,
              });
            }
          }
          
          // Check for incomplete sentences at segment boundaries
          segments.forEach((segment, index) => {
            const trimmedText = segment.text.trim();
            
            // Check if segment starts with lowercase (might be continuation)
            if (index > 0 && /^[a-zäöüõ]/.test(trimmedText)) {
              suggestions.push({
                type: "context_error",
                severity: "low",
                segmentId: segment.id,
                originalText: trimmedText.substring(0, 30) + "...",
                suggestedText: trimmedText.charAt(0).toUpperCase() + trimmedText.slice(1, 30) + "...",
                explanation: "Segment starts with lowercase - might be a continuation or needs capitalization",
                confidence: 0.6,
              });
            }
            
            // Check if segment ends abruptly (no punctuation)
            if (trimmedText.length > 10 && !/[.!?]$/.test(trimmedText)) {
              const lastWords = trimmedText.split(/\s+/).slice(-3).join(' ');
              suggestions.push({
                type: "context_error",
                severity: "low",
                segmentId: segment.id,
                originalText: "..." + lastWords,
                suggestedText: "..." + lastWords + ".",
                explanation: "Segment ends without punctuation",
                confidence: 0.7,
              });
            }
          });
        }
        
        // Check for repeated phrases (possible ASR loop error)
        const phrases = text.match(/\b(\w+(?:\s+\w+){2,4})\b/g) || [];
        const phraseCount = new Map<string, number>();
        
        phrases.forEach(phrase => {
          const normalized = phrase.toLowerCase();
          phraseCount.set(normalized, (phraseCount.get(normalized) || 0) + 1);
        });
        
        phraseCount.forEach((count, phrase) => {
          if (count > 3 && phrase.split(' ').length > 2) {
            suggestions.push({
              type: "context_error",
              severity: "medium",
              originalText: phrase,
              suggestedText: phrase,
              explanation: `Phrase "${phrase}" repeated ${count} times - possible transcription error`,
              confidence: 0.7,
            });
          }
        });
        
        return JSON.stringify({
          validated: true,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.slice(0, 20),
          contextQuality: suggestions.length < 5 ? "Good" : suggestions.length < 10 ? "Fair" : "Poor",
        });
      }
    );
  }
}