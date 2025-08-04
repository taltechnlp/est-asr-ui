import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import type { ImprovementSuggestion } from "../schemas/transcript";

const ConfidenceAnalysisSchema = z.object({
  segments: z.array(z.object({
    id: z.string(),
    text: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    start: z.number(),
    end: z.number(),
  })).describe("Transcript segments with confidence scores"),
  confidenceThreshold: z.number().min(0).max(1).default(0.7).describe("Threshold below which to flag segments"),
});

export class ConfidenceAnalyzerTool extends TranscriptAnalysisTool {
  constructor() {
    super(
      "confidence_analyzer",
      "Analyze ASR confidence scores and identify segments that may need review",
      ConfidenceAnalysisSchema,
      async ({ segments, confidenceThreshold }) => {
        const suggestions: ImprovementSuggestion[] = [];
        const lowConfidenceSegments: typeof segments = [];
        
        // Analyze confidence distribution
        const confidenceScores = segments
          .filter(s => s.confidence !== undefined)
          .map(s => s.confidence!);
        
        const avgConfidence = confidenceScores.length > 0
          ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
          : 0;
        
        const minConfidence = Math.min(...confidenceScores);
        const maxConfidence = Math.max(...confidenceScores);
        
        // Identify low confidence segments
        segments.forEach(segment => {
          if (segment.confidence !== undefined && segment.confidence < confidenceThreshold) {
            lowConfidenceSegments.push(segment);
            
            // Analyze why confidence might be low
            const reasons: string[] = [];
            
            // Check for potential issues
            if (segment.text.includes("[") || segment.text.includes("]")) {
              reasons.push("Contains unclear audio markers");
            }
            
            if (segment.text.split(' ').some(word => word.length > 15)) {
              reasons.push("Contains unusually long words (possible transcription error)");
            }
            
            if (/\d{4,}/.test(segment.text)) {
              reasons.push("Contains long number sequences");
            }
            
            if (segment.text.length < 10) {
              reasons.push("Very short segment");
            }
            
            // Check for repeated words (stuttering or ASR error)
            const words = segment.text.split(' ');
            for (let i = 0; i < words.length - 1; i++) {
              if (words[i] === words[i + 1] && words[i].length > 2) {
                reasons.push(`Repeated word: "${words[i]}"`);
                break;
              }
            }
            
            suggestions.push({
              type: "low_confidence",
              severity: segment.confidence < 0.5 ? "high" : "medium",
              segmentId: segment.id,
              originalText: segment.text,
              suggestedText: segment.text, // No automatic suggestion for low confidence
              explanation: `Low confidence score (${(segment.confidence * 100).toFixed(1)}%). ${reasons.length > 0 ? 'Possible issues: ' + reasons.join(', ') : 'Manual review recommended.'}`,
              confidence: 1 - segment.confidence, // Inverse confidence for the suggestion
            });
          }
        });
        
        // Check for sudden confidence drops
        for (let i = 1; i < segments.length; i++) {
          const prev = segments[i - 1];
          const current = segments[i];
          
          if (prev.confidence !== undefined && current.confidence !== undefined) {
            const confidenceDrop = prev.confidence - current.confidence;
            
            if (confidenceDrop > 0.3) {
              suggestions.push({
                type: "low_confidence",
                severity: "low",
                segmentId: current.id,
                originalText: current.text.substring(0, 50) + "...",
                suggestedText: current.text.substring(0, 50) + "...",
                explanation: `Sudden confidence drop from ${(prev.confidence * 100).toFixed(1)}% to ${(current.confidence * 100).toFixed(1)}%. May indicate audio quality issue.`,
                confidence: 0.7,
              });
            }
          }
        }
        
        // Overall quality assessment
        let qualityAssessment = "Good";
        if (avgConfidence < 0.6) qualityAssessment = "Poor";
        else if (avgConfidence < 0.7) qualityAssessment = "Fair";
        else if (avgConfidence < 0.85) qualityAssessment = "Good";
        else qualityAssessment = "Excellent";
        
        return JSON.stringify({
          analyzed: true,
          overallConfidence: avgConfidence,
          confidenceRange: { min: minConfidence, max: maxConfidence },
          lowConfidenceCount: lowConfidenceSegments.length,
          totalSegments: segments.length,
          qualityAssessment,
          suggestionsCount: suggestions.length,
          suggestions: suggestions.slice(0, 15),
        });
      }
    );
  }
}