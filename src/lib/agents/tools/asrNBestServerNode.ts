import { z } from "zod";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename } from "path";
import { getAudioSlicer } from "$lib/services/audioSlicer";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

export class ASRNBestServerNodeTool {
  private audioSlicer;
  private asrEndpoint: string;

  constructor(asrEndpoint: string = "https://tekstiks.ee/asr/asr") {
    this.audioSlicer = getAudioSlicer();
    this.asrEndpoint = asrEndpoint;
    console.log(`ASRNBestServerNodeTool initialized with endpoint: ${this.asrEndpoint}`);
  }

  async _call(input: z.infer<typeof ASRNBestSchema>): Promise<string> {
    const result = await this.getAlternativeTranscriptions(input);
    return JSON.stringify(result);
  }

  async getAlternativeTranscriptions(input: z.infer<typeof ASRNBestSchema>): Promise<ASRNBestResult> {
    const { audioFilePath, startTime, endTime, originalText = "", nBest } = input;
    
    // Validate timing parameters
    console.log(`ASR N-best timing validation:`, {
      audioFilePath,
      startTime: startTime.toFixed(3),
      endTime: endTime.toFixed(3),
      duration: (endTime - startTime).toFixed(3),
      originalText: originalText.substring(0, 50) + (originalText.length > 50 ? '...' : ''),
    });

    // Validate timing bounds
    if (startTime < 0) {
      console.error(`Invalid startTime: ${startTime} (must be >= 0)`);
      throw new Error(`Invalid startTime: ${startTime} seconds (must be >= 0)`);
    }

    if (endTime <= startTime) {
      console.error(`Invalid time range: startTime=${startTime}, endTime=${endTime}`);
      throw new Error(`Invalid time range: endTime (${endTime}s) must be greater than startTime (${startTime}s)`);
    }

    const duration = endTime - startTime;
    if (duration < 0.1) {
      console.warn(`Very short segment duration: ${duration}s - ASR may not produce meaningful results`);
    }

    if (duration > 120) {
      console.warn(`Long segment duration: ${duration}s - consider splitting into smaller segments for better ASR accuracy`);
    }

    let sliceResult;
    try {
      console.log(`Slicing audio from ${startTime.toFixed(3)}s to ${endTime.toFixed(3)}s (duration: ${duration.toFixed(3)}s)`);
      
      // Slice the audio file
      sliceResult = await this.audioSlicer.sliceAudio(audioFilePath, {
        startTime,
        endTime,
        format: 'wav', // Use WAV for better ASR compatibility
      });

      console.log(`Audio slice successful:`, {
        tempFilePath: sliceResult.tempFilePath,
        sliceDuration: sliceResult.duration,
        expectedDuration: duration,
        durationDiff: Math.abs(sliceResult.duration - duration),
      });

      // Use curl to upload the file - this is more reliable for multipart uploads
      const url = `${this.asrEndpoint}?n_best=${nBest}`;
      console.log(`Making ASR request using curl to: ${url}`);
      
      // Add -L to follow redirects and -v for verbose output to debug
      const curlCommand = `curl -L -X POST "${url}" -F "file=@${sliceResult.tempFilePath}" -H "Accept: application/json" 2>&1`;
      console.log(`Curl command: ${curlCommand}`);
      
      const { stdout, stderr } = await execAsync(curlCommand);
      
      // Since we're using 2>&1, all output including verbose info will be in stdout
      console.log(`Curl full output: ${stdout}`);
      
      // Extract JSON response from curl output
      // Look for the actual JSON response after the headers
      const jsonMatch = stdout.match(/\{[\s\S]*\}(?!.*\{)/);
      if (!jsonMatch) {
        console.error('No JSON found in curl output');
        throw new Error(`No JSON response found in curl output: ${stdout}`);
      }
      
      const jsonResponse = jsonMatch[0];
      console.log(`ASR API raw response: ${jsonResponse}`);
      
      let asrResult;
      try {
        asrResult = JSON.parse(jsonResponse);
      } catch (e) {
        console.error('Failed to parse ASR response as JSON:', e);
        throw new Error(`Invalid ASR response format: ${jsonResponse}`);
      }

      // Check if we got the service metadata instead of transcription result
      if (asrResult.service && asrResult.version && asrResult.endpoints) {
        throw new Error(`ASR API returned service metadata instead of transcription. Response: ${JSON.stringify(asrResult)}`);
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
          curlCommand,
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

export function createASRNBestServerNodeTool(asrEndpoint?: string): ASRNBestServerNodeTool {
  return new ASRNBestServerNodeTool(asrEndpoint);
}