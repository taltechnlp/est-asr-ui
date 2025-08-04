import { z } from "zod";
import { TranscriptAnalysisTool } from "./base";
import { getAudioSlicer } from "$lib/services/audioSlicer";
// Note: File operations will be handled server-side

const ASRNBestSchema = z.object({
  audioFilePath: z.string().describe("Path to the full audio file"),
  startTime: z.number().describe("Start time in seconds"),
  endTime: z.number().describe("End time in seconds"),
  originalText: z.string().describe("Original transcription text for context"),
  nBest: z.number().default(5).describe("Number of alternative transcriptions to retrieve"),
});

export interface ASRAlternative {
  text: string;
  confidence?: number;
}

export interface ASRNBestResult {
  alternatives: ASRAlternative[];
  primaryText: string;
  duration: number;
}

export class ASRNBestTool extends TranscriptAnalysisTool {
  private audioSlicer;
  private asrEndpoint: string;

  constructor(asrEndpoint: string = "https://tekstiks.ee/asr/asr") {
    super(
      "asr_nbest",
      "Get N-best alternative transcriptions for a specific audio segment using ASR",
      ASRNBestSchema,
      async (input) => {
        const result = await this.getAlternativeTranscriptions(input);
        return JSON.stringify(result);
      }
    );
    
    this.audioSlicer = getAudioSlicer();
    this.asrEndpoint = asrEndpoint;
  }

  async getAlternativeTranscriptions(input: z.infer<typeof ASRNBestSchema>): Promise<ASRNBestResult> {
    const { audioFilePath, startTime, endTime, originalText, nBest } = input;
    
    let sliceResult;
    try {
      // Slice the audio file
      sliceResult = await this.audioSlicer.sliceAudio(audioFilePath, {
        startTime,
        endTime,
        format: 'wav', // Use WAV for better ASR compatibility
      });

      // For server-side execution, we need to handle file reading differently
      // This will be called from the server where we have access to the file system
      const formData = new FormData();
      
      // In a server environment, we'll need to read the file using Node.js APIs
      // For now, we'll make a request to our own API that handles the file slicing
      // and ASR request server-side
      throw new Error("ASR N-best tool needs to be called from server-side context");

      // Make request to ASR API
      const response = await fetch(`${this.asrEndpoint}?n_best=${nBest}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ASR API error: ${response.status} ${response.statusText}`);
      }

      const asrResult = await response.json();

      // Format the response
      const alternatives: ASRAlternative[] = [];
      
      // Add primary transcription
      if (asrResult.text) {
        alternatives.push({
          text: asrResult.text,
          confidence: 1.0, // Primary result has highest confidence
        });
      }

      // Add alternatives
      if (asrResult.alternatives && Array.isArray(asrResult.alternatives)) {
        asrResult.alternatives.forEach((alt: any, index: number) => {
          alternatives.push({
            text: typeof alt === 'string' ? alt : alt.text,
            confidence: 0.9 - (index * 0.1), // Decreasing confidence for alternatives
          });
        });
      }

      return {
        alternatives,
        primaryText: asrResult.text || originalText,
        duration: sliceResult.duration,
      };

    } catch (error) {
      console.error('ASR N-best error:', error);
      throw new Error(`Failed to get ASR alternatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Always cleanup temp file
      if (sliceResult?.cleanup) {
        await sliceResult.cleanup();
      }
    }
  }
}

export function createASRNBestTool(asrEndpoint?: string): ASRNBestTool {
  return new ASRNBestTool(asrEndpoint);
}