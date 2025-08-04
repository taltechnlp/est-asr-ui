import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import type { ImprovementSuggestion } from "../schemas/transcript";

const SpeakerDiarizationSchema = z.object({
  segments: z.array(z.object({
    id: z.string(),
    text: z.string(),
    speaker: z.string().optional(),
    start: z.number(),
    end: z.number(),
  })).describe("Transcript segments with speaker information"),
  totalSpeakers: z.number().optional().describe("Expected number of speakers"),
});

export class SpeakerDiarizationTool extends TranscriptAnalysisTool {
  constructor() {
    super(
      "speaker_diarization",
      "Analyze and improve speaker identification in transcript segments",
      SpeakerDiarizationSchema,
      async ({ segments, totalSpeakers }) => {
        const suggestions: ImprovementSuggestion[] = [];
        
        // Analyze speaker patterns
        const speakerMap = new Map<string, { count: number; avgLength: number }>();
        const unknownSpeakers: typeof segments = [];
        
        segments.forEach(segment => {
          if (!segment.speaker || segment.speaker === "Unknown" || segment.speaker === "Speaker") {
            unknownSpeakers.push(segment);
          } else {
            const current = speakerMap.get(segment.speaker) || { count: 0, avgLength: 0 };
            current.count++;
            current.avgLength = (current.avgLength * (current.count - 1) + segment.text.length) / current.count;
            speakerMap.set(segment.speaker, current);
          }
        });
        
        // Check for inconsistent speaker labels
        if (unknownSpeakers.length > 0) {
          unknownSpeakers.forEach(segment => {
            suggestions.push({
              type: "speaker_change",
              severity: "medium",
              segmentId: segment.id,
              originalText: `[${segment.speaker || "Unknown"}]: ${segment.text.substring(0, 50)}...`,
              suggestedText: `[Speaker X]: ${segment.text.substring(0, 50)}...`,
              explanation: "Unidentified speaker - consider assigning a consistent speaker label",
              confidence: 0.7,
            });
          });
        }
        
        // Check for potential speaker merging opportunities
        const speakers = Array.from(speakerMap.entries());
        for (let i = 0; i < speakers.length; i++) {
          for (let j = i + 1; j < speakers.length; j++) {
            const [speaker1, stats1] = speakers[i];
            const [speaker2, stats2] = speakers[j];
            
            // If two speakers have very similar average segment lengths and appear intermittently,
            // they might be the same person
            const lengthRatio = Math.min(stats1.avgLength, stats2.avgLength) / 
                               Math.max(stats1.avgLength, stats2.avgLength);
            
            if (lengthRatio > 0.8 && Math.abs(stats1.count - stats2.count) < 5) {
              suggestions.push({
                type: "speaker_change",
                severity: "low",
                originalText: `${speaker1} and ${speaker2}`,
                suggestedText: `Merge ${speaker1} and ${speaker2}`,
                explanation: `Speakers '${speaker1}' and '${speaker2}' have similar speaking patterns and might be the same person`,
                confidence: 0.6,
              });
            }
          }
        }
        
        // Check for rapid speaker changes that might be errors
        for (let i = 1; i < segments.length - 1; i++) {
          const prev = segments[i - 1];
          const current = segments[i];
          const next = segments[i + 1];
          
          // If a speaker has only one short segment between two segments of another speaker
          if (prev.speaker === next.speaker && 
              prev.speaker !== current.speaker &&
              current.text.split(' ').length < 5) {
            suggestions.push({
              type: "speaker_change",
              severity: "low",
              segmentId: current.id,
              originalText: `[${current.speaker}]: ${current.text}`,
              suggestedText: `[${prev.speaker}]: ${current.text}`,
              explanation: "Short segment might belong to surrounding speaker",
              confidence: 0.5,
            });
          }
        }
        
        // Check if number of identified speakers matches expected
        if (totalSpeakers && speakerMap.size !== totalSpeakers) {
          suggestions.push({
            type: "speaker_change",
            severity: "medium",
            originalText: `Identified ${speakerMap.size} speakers`,
            suggestedText: `Expected ${totalSpeakers} speakers`,
            explanation: `Speaker count mismatch: found ${speakerMap.size} but expected ${totalSpeakers}`,
            confidence: 0.8,
          });
        }
        
        return JSON.stringify({
          analyzed: true,
          identifiedSpeakers: Array.from(speakerMap.keys()),
          unknownSegments: unknownSpeakers.length,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.slice(0, 10),
        });
      }
    );
  }
}