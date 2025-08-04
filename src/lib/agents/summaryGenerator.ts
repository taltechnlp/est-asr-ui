import { createOpenRouterChat, OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { HumanMessage } from "@langchain/core/messages";
import { prisma } from "$lib/db/client";
import type { TranscriptSummary } from "@prisma/client";

export interface SummaryGenerationOptions {
  forceRegenerate?: boolean;
  modelName?: string;
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

Respond in JSON format:
{
  "summary": "comprehensive summary here...",
  "keyTopics": ["topic1", "topic2", ...],
  "speakerCount": number,
  "language": "et|fi|en"
}`;

export class SummaryGenerator {
  private model;

  constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3, // Lower temperature for consistent summaries
      maxTokens: 2000,
    });
  }

  async generateSummary(
    fileId: string,
    transcript: string,
    options: SummaryGenerationOptions = {}
  ): Promise<TranscriptSummary> {
    // Check if summary already exists
    if (!options.forceRegenerate) {
      const existingSummary = await prisma.transcriptSummary.findUnique({
        where: { fileId },
      });

      if (existingSummary) {
        return existingSummary;
      }
    }

    try {
      // Generate summary using LLM
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

      const result: SummaryResult = JSON.parse(jsonMatch[0]);

      // Store in database
      const summary = await prisma.transcriptSummary.upsert({
        where: { fileId },
        create: {
          fileId,
          summary: result.summary,
          keyTopics: result.keyTopics,
          speakerCount: result.speakerCount,
          language: result.language,
        },
        update: {
          summary: result.summary,
          keyTopics: result.keyTopics,
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