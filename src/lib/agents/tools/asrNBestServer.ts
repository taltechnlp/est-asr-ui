import { z } from "zod";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename } from "path";
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

      // For server-side file upload, we need to use a different approach
      // Using node-fetch or undici for proper file upload from Node.js
      const fileBuffer = await readFile(sliceResult.tempFilePath);
      
      // Dynamic import to use form-data package for Node.js
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      // Append the file buffer directly
      formData.append('file', fileBuffer, {
        filename: 'segment.wav',
        contentType: 'audio/wav',
      });

      // Make request to ASR API with proper headers
      const response = await fetch(`${this.asrEndpoint}?n_best=${nBest}`, {
        method: 'POST',
        body: formData as any,
        headers: {
          ...formData.getHeaders(),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ASR API error response: ${errorText}`);
        throw new Error(`ASR API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log(`ASR API raw response: ${responseText}`);
      
      let asrResult;
      try {
        asrResult = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse ASR response as JSON:', e);
        throw new Error(`Invalid ASR response format: ${responseText}`);
      }

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

      const result = {
        alternatives,
        primaryText: asrResult.text || originalText,
        duration: sliceResult.duration,
      };

      // Save the result to a file for debugging and future reference
      try {
        // Create directory structure based on audio file path
        const audioFileBase = basename(audioFilePath, '.wav').replace(/\.[^/.]+$/, '');
        const nbestDir = join(dirname(audioFilePath), 'asr-nbest', audioFileBase);
        await mkdir(nbestDir, { recursive: true });

        // Create filename with timestamp and segment info
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const segmentInfo = `${startTime.toFixed(1)}-${endTime.toFixed(1)}s`;
        const filename = `nbest_${segmentInfo}_${timestamp}.json`;
        const filepath = join(nbestDir, filename);

        // Save the full ASR response and formatted result
        const dataToSave = {
          request: {
            audioFilePath,
            startTime,
            endTime,
            originalText,
            nBest,
          },
          rawResponse: asrResult,
          formattedResult: result,
          timestamp: new Date().toISOString(),
        };

        await writeFile(filepath, JSON.stringify(dataToSave, null, 2));
        console.log(`ASR N-best results saved to: ${filepath}`);
      } catch (saveError) {
        console.error('Failed to save ASR N-best results to file:', saveError);
        // Don't throw - this is just for debugging, shouldn't break the main flow
      }

      return result;

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