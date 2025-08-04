import { createOpenRouterChat, OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { HumanMessage } from "@langchain/core/messages";
import { createWebSearchTool } from "./tools";
import { createASRNBestServerNodeTool } from "./tools/asrNBestServerNode";
import type { TranscriptSummary, AnalysisSegment } from "@prisma/client";
import { prisma } from "$lib/db/client";
import type { SegmentWithTiming } from "$lib/utils/extractWordsFromEditor";

export interface SegmentAnalysisRequest {
  fileId: string;
  segment: SegmentWithTiming;
  summary: TranscriptSummary;
  audioFilePath: string;
}

export interface SegmentAnalysisResult {
  segmentIndex: number;
  analysis: string;
  suggestions: any[];
  nBestResults?: any;
  confidence: number;
}

const SEGMENT_ANALYSIS_PROMPT = `You are an expert transcript analyst specializing in Estonian and Finnish languages.

Context from full transcript summary:
{summary}

Current speaker segment to analyze (speaker turn {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds
Word count: {wordCount} words

This is a complete speaker turn - analyze the entire utterance from {speaker}.

Your task:
1. Analyze this complete speaker turn for quality, accuracy, and coherence
2. Consider the context from the full transcript summary
3. Identify potential transcription errors or unclear passages within this speaker's utterance
4. Check if the speaker boundaries are appropriate (does it seem like one coherent turn?)
5. Note if you would need alternative transcriptions or additional context
6. Provide specific improvement suggestions for this speaker's turn

Focus on:
- Grammar and language correctness throughout the speaker's turn
- Internal coherence within this speaker's utterance
- Consistency with the overall transcript context
- Proper nouns and technical terms accuracy
- Speaker attribution accuracy (is this all from the same speaker?)
- Natural speech patterns and turn-taking
- Punctuation and formatting

Provide a detailed analysis with actionable suggestions in the following JSON format:
{
  "analysis": "Your detailed analysis of this speaker's complete turn",
  "confidence": 0.85, // Your confidence in the transcription accuracy (0-1)
  "needsAlternatives": false, // Whether ASR alternatives would be helpful
  "needsWebSearch": [], // List of terms that need web search verification
  "suggestions": [
    {
      "type": "grammar|punctuation|clarity|consistency|speaker|boundary",
      "severity": "low|medium|high",
      "text": "Description of the issue",
      "originalText": "problematic text",
      "suggestedText": "corrected text",
      "confidence": 0.9
    }
  ]
}`;

export class CoordinatingAgentSimple {
  private model;
  private asrTool;
  private webSearchTool;

  constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3,
      maxTokens: 2000,
    });

    // The service is mounted at /asr and the endpoint is /transcribe/alternatives
    // So the full URL is /asr/transcribe/alternatives
    this.asrTool = createASRNBestServerNodeTool("https://tekstiks.ee/asr/transcribe/alternatives/");
    this.webSearchTool = createWebSearchTool();
  }

  async analyzeSegment(request: SegmentAnalysisRequest): Promise<SegmentAnalysisResult> {
    try {
      const { segment, summary, audioFilePath, fileId } = request;

      // Build the analysis prompt
      const prompt = SEGMENT_ANALYSIS_PROMPT
        .replace("{summary}", summary.summary)
        .replace("{segmentIndex}", (segment.index + 1).toString())
        .replace("{totalSegments}", "TBD")
        .replace(/\{speaker\}/g, segment.speakerName || segment.speakerTag) // Replace all occurrences
        .replace("{text}", segment.text)
        .replace("{duration}", (segment.endTime - segment.startTime).toFixed(2))
        .replace("{wordCount}", segment.words.length.toString());

      // Get initial analysis
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      // Parse the response
      let analysisData;
      try {
        const content = response.content as string;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        analysisData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse analysis response:", e);
        analysisData = {
          analysis: response.content,
          confidence: 0.7,
          needsAlternatives: false,
          needsWebSearch: [],
          suggestions: [],
        };
      }

      let nBestResults = null;

      // Use ASR N-best tool if needed
      if (analysisData.needsAlternatives) {
        try {
          const asrResult = await this.asrTool._call({
            audioFilePath,
            startTime: segment.startTime,
            endTime: segment.endTime,
            nBest: 5,
          });
          nBestResults = JSON.parse(asrResult);
        } catch (e) {
          console.error("ASR N-best tool error:", e);
        }
      }

      // Use web search for unfamiliar terms
      if (analysisData.needsWebSearch && analysisData.needsWebSearch.length > 0) {
        for (const term of analysisData.needsWebSearch) {
          try {
            const searchResult = await this.webSearchTool._call({
              query: term,
              language: summary.language,
            });
            // Could enhance analysis with search results
            console.log(`Web search for "${term}":`, searchResult);
          } catch (e) {
            console.error(`Web search error for "${term}":`, e);
          }
        }
      }

      // Save to database
      await prisma.analysisSegment.upsert({
        where: {
          fileId_segmentIndex: {
            fileId,
            segmentIndex: segment.index,
          },
        },
        create: {
          fileId,
          segmentIndex: segment.index,
          startTime: segment.startTime,
          endTime: segment.endTime,
          startWord: segment.startWord,
          endWord: segment.endWord,
          originalText: segment.text,
          speakerName: segment.speakerName || segment.speakerTag,
          analysis: analysisData.analysis,
          suggestions: analysisData.suggestions,
          nBestResults,
          status: "analyzed",
        },
        update: {
          speakerName: segment.speakerName || segment.speakerTag,
          analysis: analysisData.analysis,
          suggestions: analysisData.suggestions,
          nBestResults,
          status: "analyzed",
        },
      });

      return {
        segmentIndex: segment.index,
        analysis: analysisData.analysis,
        suggestions: analysisData.suggestions,
        nBestResults,
        confidence: analysisData.confidence,
      };
    } catch (error) {
      console.error("Segment analysis error:", error);
      throw new Error(`Failed to analyze segment: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getAnalyzedSegments(fileId: string): Promise<AnalysisSegment[]> {
    return prisma.analysisSegment.findMany({
      where: { fileId },
      orderBy: { segmentIndex: "asc" },
    });
  }
}

// Singleton instance
let coordinatingAgentInstance: CoordinatingAgentSimple | null = null;

export function getCoordinatingAgent(modelName?: string): CoordinatingAgentSimple {
  if (!coordinatingAgentInstance || modelName) {
    coordinatingAgentInstance = new CoordinatingAgentSimple(modelName);
  }
  return coordinatingAgentInstance;
}