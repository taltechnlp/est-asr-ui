import { z } from "zod";
import type { Word, Speaker } from "$lib/helpers/converters/types";

// Schema for transcript segment
export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  speaker: z.string().optional(),
  start: z.number(),
  end: z.number(),
  confidence: z.number().optional(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

// Schema for transcript analysis request
export const TranscriptAnalysisRequestSchema = z.object({
  transcript: z.string(),
  segments: z.array(TranscriptSegmentSchema).optional(),
  words: z.array(z.object({
    id: z.string(),
    start: z.number(),
    end: z.number(),
  })).optional(),
  speakers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    start: z.number(),
    end: z.number(),
  })).optional(),
  language: z.enum(["et", "fi", "en"]).default("et"),
  analysisType: z.enum([
    "grammar",
    "punctuation",
    "speaker_diarization",
    "confidence",
    "context",
    "full"
  ]).default("full"),
});

export type TranscriptAnalysisRequest = z.infer<typeof TranscriptAnalysisRequestSchema>;

// Schema for improvement suggestion
export const ImprovementSuggestionSchema = z.object({
  type: z.enum([
    "grammar",
    "punctuation",
    "speaker_change",
    "low_confidence",
    "context_error",
    "formatting"
  ]),
  severity: z.enum(["low", "medium", "high"]),
  segmentId: z.string().optional(),
  startOffset: z.number().optional(),
  endOffset: z.number().optional(),
  originalText: z.string(),
  suggestedText: z.string(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
});

export type ImprovementSuggestion = z.infer<typeof ImprovementSuggestionSchema>;

// Schema for analysis result
export const TranscriptAnalysisResultSchema = z.object({
  suggestions: z.array(ImprovementSuggestionSchema),
  summary: z.string(),
  overallQuality: z.number().min(0).max(1),
  metadata: z.object({
    totalWords: z.number(),
    totalSpeakers: z.number(),
    duration: z.number().optional(),
    language: z.string(),
  }),
});

export type TranscriptAnalysisResult = z.infer<typeof TranscriptAnalysisResultSchema>;

// State schema for LangGraph
export const TranscriptAnalysisStateSchema = z.object({
  request: TranscriptAnalysisRequestSchema,
  currentAnalysis: z.string().optional(),
  suggestions: z.array(ImprovementSuggestionSchema).default([]),
  toolResults: z.record(z.string(), z.any()).default({}),
  summary: z.string().optional(),
  error: z.string().optional(),
});

export type TranscriptAnalysisState = z.infer<typeof TranscriptAnalysisStateSchema>;