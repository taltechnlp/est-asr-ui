import { z } from "zod";
import { readFile } from "fs/promises";
import { getAudioSlicer } from "$lib/services/audioSlicer";

const ASRNBestSchema = z.object({
  audioFilePath: z.string().describe("Path to the full audio file"),
  startTime: z.number().describe("Start time in seconds"),
  endTime: z.number().describe("End time in seconds"),
  originalText: z.string().optional().describe("Original transcription text for context"),
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

export class ASRNBestServerTool {
  private audioSlicer;
  private asrEndpoint: string;

  constructor(asrEndpoint: string = "https://tekstiks.ee/asr/asr") {
    this.audioSlicer = getAudioSlicer();
    this.asrEndpoint = asrEndpoint;
  }

  async _call(input: z.infer<typeof ASRNBestSchema>): Promise<string> {
    const result = await this.getAlternativeTranscriptions(input);
    return JSON.stringify(result);
  }

  async getAlternativeTranscriptions(input: z.infer<typeof ASRNBestSchema>): Promise<ASRNBestResult> {
    const { audioFilePath, startTime, endTime, originalText = "", nBest } = input;
    
    let sliceResult;
    try {
      // Slice the audio file
      sliceResult = await this.audioSlicer.sliceAudio(audioFilePath, {
        startTime,
        endTime,
        format: 'wav', // Use WAV for better ASR compatibility
      });

      // Read the file as a buffer
      const fileBuffer = await readFile(sliceResult.tempFilePath);
      
      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(fileBuffer);
      
      // Create form data for file upload
      const formData = new FormData();
      const blob = new Blob([uint8Array], { type: 'audio/wav' });
      formData.append('file', blob, 'segment.wav');

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

export function createASRNBestServerTool(asrEndpoint?: string): ASRNBestServerTool {
  return new ASRNBestServerTool(asrEndpoint);
}