import { createOpenRouterChat, OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { HumanMessage } from "@langchain/core/messages";
import { prisma } from "$lib/db/client";
import type { TranscriptSummary } from "@prisma/client";
import { getLanguageName, normalizeLanguageCode, type SupportedLanguage } from "$lib/utils/language";

export interface SummaryGenerationOptions {
  forceRegenerate?: boolean;
  modelName?: string;
  uiLanguage?: string;
}

export interface SummaryResult {
  summary: string;
  keyTopics: string[];
  speakerCount: number;
  language: string;
}

const SUMMARY_PROMPT = `You are an expert transcript analyst. Analyze the following transcript and provide:

1. A comprehensive summary (2-3 paragraphs) that captures:
   - Main topics discussed
   - Key decisions or conclusions
   - Important action items or next steps
   - Overall tone and context

2. Extract 5-10 key topics/themes as short phrases

3. Count the number of unique speakers

4. Identify the primary language (et/fi/en)

Transcript:
{transcript}

IMPORTANT: Provide your summary in English for consistency.

Respond in JSON format:
{
  "summary": "comprehensive summary here...",
  "keyTopics": ["topic1", "topic2", ...],
  "speakerCount": number,
  "language": "et|fi|en"
}`;

const DISPLAY_SUMMARY_PROMPT = `You are an expert transcript analyst. Create a user-friendly summary of the following transcript.

Provide a comprehensive summary (2-3 paragraphs) that captures:
- Main topics discussed
- Key decisions or conclusions
- Important action items or next steps
- Overall tone and context

Transcript:
{transcript}

IMPORTANT: Provide your summary in {language} language.

Respond with just the summary text, no JSON formatting needed.`;

const TRANSLATE_KEY_TOPICS_PROMPT = `Translate the following key topics/themes to {language} language. Keep them as short phrases.

Topics to translate:
{topics}

IMPORTANT: Respond in {language} language with a JSON array of translated topics.

Example response format:
["translated topic 1", "translated topic 2", ...]`;

export class SummaryGenerator {
  private model;

  constructor(modelName: string = OPENROUTER_MODELS.GPT_4O) {
    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3, // Lower temperature for consistent summaries
      maxTokens: 2000,
    });
  }

  private cleanJsonString(str: string): string {
    // Remove control characters except for valid JSON whitespace
    return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      // Also remove any non-breaking spaces that might cause issues
      .replace(/\u00A0/g, ' ')
      // Normalize quotes
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');
  }

  async generateSummary(
    fileId: string,
    transcript: string,
    options: SummaryGenerationOptions = {}
  ): Promise<TranscriptSummary> {
    const uiLanguage = normalizeLanguageCode(options.uiLanguage);
    
    // Check if summary already exists and matches the requested UI language
    if (!options.forceRegenerate) {
      const existingSummary = await prisma.transcriptSummary.findUnique({
        where: { fileId },
      });

      if (existingSummary) {
        // If we need a different UI language or don't have a display summary yet
        if (existingSummary.uiLanguage !== uiLanguage || !existingSummary.displaySummary) {
          // Generate display summary in the requested language if needed
          if (uiLanguage !== 'en') {
            const displaySummary = await this.generateDisplaySummary(transcript, uiLanguage);
            const displayKeyTopics = await this.translateKeyTopics(existingSummary.keyTopics, uiLanguage);
            const updated = await prisma.transcriptSummary.update({
              where: { fileId },
              data: {
                displaySummary,
                displayKeyTopics,
                uiLanguage,
              },
            });
            return updated;
          }
        }
        return existingSummary;
      }
    }

    try {
      // Generate main summary in English
      const prompt = SUMMARY_PROMPT.replace("{transcript}", transcript);
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      // Parse the JSON response
      const content = response.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse summary response");
      }

      // Clean the JSON string before parsing
      const cleanedJson = this.cleanJsonString(jsonMatch[0]);
      
      let result: SummaryResult;
      try {
        result = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Original JSON:", jsonMatch[0]);
        console.error("Cleaned JSON:", cleanedJson);
        throw new Error(`Failed to parse summary JSON: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`);
      }

      // Generate display summary and translate key topics in UI language if different from English
      let displaySummary: string | null = null;
      let displayKeyTopics: string[] = result.keyTopics;
      
      if (uiLanguage !== 'en') {
        displaySummary = await this.generateDisplaySummary(transcript, uiLanguage);
        displayKeyTopics = await this.translateKeyTopics(result.keyTopics, uiLanguage);
      }

      // Store in database
      const summary = await prisma.transcriptSummary.upsert({
        where: { fileId },
        create: {
          fileId,
          summary: result.summary,
          displaySummary,
          uiLanguage: uiLanguage !== 'en' ? uiLanguage : null,
          keyTopics: result.keyTopics,
          displayKeyTopics,
          speakerCount: result.speakerCount,
          language: result.language,
        },
        update: {
          summary: result.summary,
          displaySummary,
          uiLanguage: uiLanguage !== 'en' ? uiLanguage : null,
          keyTopics: result.keyTopics,
          displayKeyTopics,
          speakerCount: result.speakerCount,
          language: result.language,
        },
      });

      return summary;
    } catch (error) {
      console.error("Summary generation error:", error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async generateDisplaySummary(transcript: string, uiLanguage: SupportedLanguage): Promise<string> {
    try {
      const languageName = getLanguageName(uiLanguage);
      const prompt = DISPLAY_SUMMARY_PROMPT
        .replace("{transcript}", transcript)
        .replace("{language}", languageName);
      
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      return response.content as string;
    } catch (error) {
      console.error("Display summary generation error:", error);
      throw new Error(`Failed to generate display summary: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async translateKeyTopics(topics: string[], uiLanguage: SupportedLanguage): Promise<string[]> {
    try {
      const languageName = getLanguageName(uiLanguage);
      const prompt = TRANSLATE_KEY_TOPICS_PROMPT
        .replace("{topics}", topics.join("\n"))
        .replace(/{language}/g, languageName);
      
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      const content = response.content as string;
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("Failed to parse translated topics response:", content);
        return topics; // Return original topics as fallback
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Key topics translation error:", error);
      return topics; // Return original topics as fallback
    }
  }

  async getSummary(fileId: string): Promise<TranscriptSummary | null> {
    return prisma.transcriptSummary.findUnique({
      where: { fileId },
    });
  }

  async deleteSummary(fileId: string): Promise<void> {
    await prisma.transcriptSummary.delete({
      where: { fileId },
    }).catch(() => {
      // Ignore if summary doesn't exist
    });
  }
}

// Singleton instance
let summaryGeneratorInstance: SummaryGenerator | null = null;

export function getSummaryGenerator(modelName?: string): SummaryGenerator {
  if (!summaryGeneratorInstance || modelName) {
    summaryGeneratorInstance = new SummaryGenerator(modelName);
  }
  return summaryGeneratorInstance;
}