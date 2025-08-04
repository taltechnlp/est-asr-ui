import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import type { ImprovementSuggestion } from "../schemas/transcript";

const PunctuationCheckSchema = z.object({
  text: z.string().describe("The text to check for punctuation issues"),
  language: z.enum(["et", "fi", "en"]).describe("Language of the text"),
  speakerChanges: z.array(z.number()).optional().describe("Positions where speaker changes occur"),
});

export class PunctuationFixerTool extends TranscriptAnalysisTool {
  constructor() {
    super(
      "punctuation_fixer",
      "Fix punctuation issues in transcribed text, including missing periods, commas, and capitalization",
      PunctuationCheckSchema,
      async ({ text, language, speakerChanges }) => {
        const suggestions: ImprovementSuggestion[] = [];
        
        // Check for missing sentence-ending punctuation
        const sentences = text.split(/[.!?]+/);
        sentences.forEach((sentence, index) => {
          const trimmed = sentence.trim();
          if (trimmed.length > 0 && index < sentences.length - 1) {
            // Check if next sentence starts with lowercase
            const nextSentence = sentences[index + 1]?.trim();
            if (nextSentence && /^[a-zäöüõ]/.test(nextSentence)) {
              suggestions.push({
                type: "punctuation",
                severity: "high",
                originalText: trimmed + " " + nextSentence.substring(0, 20),
                suggestedText: trimmed + ". " + nextSentence.charAt(0).toUpperCase() + nextSentence.slice(1, 20),
                explanation: "Sentence should end with punctuation and next sentence should start with capital letter",
                confidence: 0.9,
              });
            }
          }
        });
        
        // Check for missing commas in lists
        const listPattern = /(\w+)\s+(ja|ning|või|tai|and|or|och|eller)\s+(\w+)/gi;
        let match;
        while ((match = listPattern.exec(text)) !== null) {
          const beforeMatch = text.substring(Math.max(0, match.index - 30), match.index);
          // Check if this might be part of a list
          if (beforeMatch.includes(',') || beforeMatch.match(/\b(nagu|näiteks|like|such as|kuten)\b/i)) {
            suggestions.push({
              type: "punctuation",
              severity: "low",
              originalText: match[0],
              suggestedText: match[1] + ", " + match[2] + " " + match[3],
              explanation: "Consider adding comma before conjunction in a list",
              confidence: 0.6,
            });
          }
        }
        
        // Check for speaker change punctuation
        if (speakerChanges && speakerChanges.length > 0) {
          speakerChanges.forEach(position => {
            const contextStart = Math.max(0, position - 50);
            const contextEnd = Math.min(text.length, position + 50);
            const context = text.substring(contextStart, contextEnd);
            
            // Check if there's proper punctuation at speaker change
            const beforeChange = text.substring(Math.max(0, position - 20), position).trim();
            if (beforeChange && !/[.!?]$/.test(beforeChange)) {
              suggestions.push({
                type: "punctuation",
                severity: "medium",
                originalText: beforeChange,
                suggestedText: beforeChange + ".",
                explanation: "Add period before speaker change",
                confidence: 0.8,
              });
            }
          });
        }
        
        // Language-specific checks
        if (language === "et" || language === "fi") {
          // Check for missing question marks in questions
          const questionWords = language === "et" 
            ? ["kas", "mis", "kes", "kus", "millal", "miks", "kuidas"]
            : ["onko", "mikä", "kuka", "missä", "milloin", "miksi", "miten"];
          
          questionWords.forEach(word => {
            const questionPattern = new RegExp(`\\b${word}\\b[^.!?]*[^.!?\\s]\\s*$`, 'gim');
            let match;
            while ((match = questionPattern.exec(text)) !== null) {
              suggestions.push({
                type: "punctuation",
                severity: "high",
                originalText: match[0],
                suggestedText: match[0] + "?",
                explanation: `Question starting with '${word}' should end with question mark`,
                confidence: 0.85,
              });
            }
          });
        }
        
        return JSON.stringify({
          checked: true,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.slice(0, 10), // Limit suggestions
        });
      }
    );
  }
}