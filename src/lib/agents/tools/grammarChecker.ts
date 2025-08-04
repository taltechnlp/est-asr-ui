import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import type { ImprovementSuggestion } from "../schemas/transcript";

const GrammarCheckSchema = z.object({
  text: z.string().describe("The text to check for grammar issues"),
  language: z.enum(["et", "fi", "en"]).describe("Language of the text"),
  context: z.string().optional().describe("Additional context around the text"),
});

export class GrammarCheckerTool extends TranscriptAnalysisTool {
  constructor() {
    super(
      "grammar_checker",
      "Check text for grammar issues and suggest corrections. Particularly useful for Estonian and Finnish languages.",
      GrammarCheckSchema,
      async ({ text, language, context }) => {
        // This is a placeholder implementation
        // In a real implementation, you might:
        // 1. Use a language-specific grammar checker API
        // 2. Apply rule-based grammar checks
        // 3. Use an LLM for grammar analysis
        
        const suggestions: ImprovementSuggestion[] = [];
        
        // Example: Check for common Estonian grammar issues
        if (language === "et") {
          // Check for missing commas before 'et' (that/because)
          const etPattern = /\s+et\s+/g;
          let match;
          while ((match = etPattern.exec(text)) !== null) {
            const beforeEt = text.substring(Math.max(0, match.index - 10), match.index);
            if (beforeEt && !beforeEt.endsWith(',')) {
              suggestions.push({
                type: "grammar",
                severity: "medium",
                originalText: beforeEt + match[0],
                suggestedText: beforeEt + "," + match[0],
                explanation: "Estonian requires a comma before 'et' when introducing a subordinate clause",
                confidence: 0.8,
              });
            }
          }
        }
        
        // Example: Check for Finnish grammar issues
        if (language === "fi") {
          // Check for partitive case usage
          // This is simplified - real implementation would be more complex
          const partitiveCheck = /\b(paljon|vähän|monta)\s+\w+a\b/gi;
          if (!partitiveCheck.test(text)) {
            // Check if quantifiers are followed by nominative instead of partitive
            const quantifierPattern = /\b(paljon|vähän|monta)\s+(\w+)(?!a\b)/gi;
            let match;
            while ((match = quantifierPattern.exec(text)) !== null) {
              suggestions.push({
                type: "grammar",
                severity: "medium",
                originalText: match[0],
                suggestedText: match[1] + " " + match[2] + "a",
                explanation: "Finnish quantifiers require partitive case",
                confidence: 0.7,
              });
            }
          }
        }
        
        return JSON.stringify({
          checked: true,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.slice(0, 5), // Limit to top 5 suggestions
        });
      }
    );
  }
}