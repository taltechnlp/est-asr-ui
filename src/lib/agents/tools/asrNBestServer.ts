import { z } from "zod";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename } from "path";
// AudioSlicer will be loaded conditionally to avoid client-side import issues

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
  private audioSlicer: any = null;
  private asrEndpoint: string;

  constructor(asrEndpoint: string = "https://tekstiks.ee/asr/transcribe/alternatives") {
    // Use the endpoint as provided - don't modify it
    this.asrEndpoint = asrEndpoint;
    console.log(`ASRNBestServerTool initialized with endpoint: ${this.asrEndpoint}`);
  }

  private async initializeAudioSlicer() {
    if (this.audioSlicer) return; // Already initialized
    
    if (typeof window === 'undefined') {
      try {
        const module = await import("$lib/services/audioSlicer");
        this.audioSlicer = module.getAudioSlicer();
      } catch (e) {
        console.warn('Failed to load AudioSlicer:', e);
        throw new Error('AudioSlicer not available - this tool can only be used server-side');
      }
    } else {
      throw new Error('AudioSlicer not available in client-side context');
    }
  }

  async _call(input: z.infer<typeof ASRNBestSchema>): Promise<string> {
    const result = await this.getAlternativeTranscriptions(input);
    return JSON.stringify(result);
  }

  async getAlternativeTranscriptions(input: z.infer<typeof ASRNBestSchema>): Promise<ASRNBestResult> {
    const { audioFilePath, startTime, endTime, originalText = "", nBest } = input;
    
    let sliceResult;
    try {
      // Initialize audioSlicer if needed
      await this.initializeAudioSlicer();

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

      // Log the exact URL we're using
      const url = `${this.asrEndpoint}?n_best=${nBest}`;
      console.log(`Making ASR request to: ${url}`);
      console.log(`Form data headers:`, formData.getHeaders());
      
      // Make request to ASR API with proper headers
      // Add redirect: 'error' to prevent automatic redirects
      const response = await fetch(url, {
        method: 'POST',
        body: formData as any,
        headers: {
          ...formData.getHeaders(),
        },
        redirect: 'manual', // Don't follow redirects automatically
      });
      
      console.log(`ASR response status: ${response.status}`);
      console.log(`ASR response headers:`, response.headers);
      
      // Check if we got redirected
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        console.error(`ASR API redirected to: ${location}`);
        throw new Error(`ASR API redirected to: ${location}. This suggests the endpoint configuration is incorrect.`);
      }

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

      // Check if we got the service metadata instead of transcription result
      if (asrResult.service && asrResult.version && asrResult.endpoints) {
        throw new Error(`ASR API returned service metadata instead of transcription. This usually means the request was redirected or the endpoint is incorrect. Response: ${JSON.stringify(asrResult)}`);
      }

      // Format the response
      const alternatives: ASRAlternative[] = [];
      
      // The ASR API returns alternatives as an array of objects with text property
      if (asrResult.alternatives && Array.isArray(asrResult.alternatives)) {
        asrResult.alternatives.forEach((alt: any) => {
          alternatives.push({
            text: alt.text || alt,
            confidence: alt.confidence || (alt.beam_size ? 1.0 - (alt.beam_size - 5) * 0.02 : 0.9),
          });
        });
      } else if (asrResult.text) {
        // If no alternatives but there's a main text, use it
        alternatives.push({
          text: asrResult.text,
          confidence: 1.0,
        });
      }

      const result = {
        alternatives,
        primaryText: asrResult.text || (alternatives.length > 0 ? alternatives[0].text : originalText),
        duration: asrResult.duration || sliceResult.duration,
      };

      // Log the actual ASR response for debugging
      console.log('ASR API response structure:', {
        hasText: !!asrResult.text,
        hasAlternatives: !!asrResult.alternatives,
        alternativesCount: asrResult.alternatives?.length || 0,
        hasError: !!asrResult.error,
        keys: Object.keys(asrResult),
      });

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