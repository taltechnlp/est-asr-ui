import { z } from "zod";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, basename } from "path";
// AudioSlicer will be loaded conditionally to avoid client-side import issues
import { exec } from "child_process";
import { robustJsonParse } from '../utils/jsonParser';
import { promisify } from "util";
import { getCurrentLogger } from '../../utils/agentFileLogger';

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
  private audioSlicer: any = null;
  private asrEndpoint: string;

  constructor(asrEndpoint: string = "https://tekstiks.ee/asr/transcribe/alternatives") {
    this.asrEndpoint = asrEndpoint;
    // ASR tool initialization logging moved to file logger when called
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
    const logger = getCurrentLogger();
    
    // Validate timing parameters
    await logger?.logToolExecution('ASR-NBest', 'Starting alternative transcription request', {
      audioFile: audioFilePath.split('/').pop() || 'unknown',
      startTime: startTime.toFixed(3),
      endTime: endTime.toFixed(3),
      duration: (endTime - startTime).toFixed(3),
      originalTextPreview: originalText.substring(0, 50) + (originalText.length > 50 ? '...' : ''),
      nBest
    });

    // Validate timing bounds
    if (startTime < 0) {
      await logger?.logToolExecution('ASR-NBest', 'Invalid startTime parameter', { startTime, error: 'must be >= 0' });
      throw new Error(`Invalid startTime: ${startTime} seconds (must be >= 0)`);
    }

    if (endTime <= startTime) {
      await logger?.logToolExecution('ASR-NBest', 'Invalid time range', { startTime, endTime, error: 'endTime must be > startTime' });
      throw new Error(`Invalid time range: endTime (${endTime}s) must be greater than startTime (${startTime}s)`);
    }

    const duration = endTime - startTime;
    if (duration < 0.1) {
      await logger?.logToolExecution('ASR-NBest', 'Warning: very short segment duration', { duration, warning: 'ASR may not produce meaningful results' });
    }

    if (duration > 120) {
      await logger?.logToolExecution('ASR-NBest', 'Warning: long segment duration', { duration, warning: 'consider splitting for better accuracy' });
    }

    let sliceResult;
    try {
      await logger?.logToolExecution('ASR-NBest', 'Slicing audio segment', {
        startTime: startTime.toFixed(3),
        endTime: endTime.toFixed(3), 
        duration: duration.toFixed(3)
      });
      
      // Initialize audioSlicer if needed
      await this.initializeAudioSlicer();

      // Slice the audio file
      sliceResult = await this.audioSlicer.sliceAudio(audioFilePath, {
        startTime,
        endTime,
        format: 'wav', // Use WAV for better ASR compatibility
      });

      await logger?.logToolExecution('ASR-NBest', 'Audio slice completed successfully', {
        tempFilePath: sliceResult.tempFilePath.split('/').pop() || 'unknown',
        sliceDuration: sliceResult.duration,
        expectedDuration: duration,
        durationDiff: Math.abs(sliceResult.duration - duration)
      });

      // Use curl to upload the file - this is more reliable for multipart uploads
      const url = `${this.asrEndpoint}?n_best=${nBest}`;
      await logger?.logToolExecution('ASR-NBest', 'Making ASR API request', {
        endpoint: url
      });
      
      // Add -L to follow redirects and -v for verbose output to debug
      const curlCommand = `curl -L -X POST "${url}" -F "file=@${sliceResult.tempFilePath}" -H "Accept: application/json" 2>&1`;
      await logger?.logToolExecution('ASR-NBest', 'Executing curl command', {
        command: curlCommand.replace(sliceResult.tempFilePath, '[temp-file]')
      });
      
      const { stdout, stderr } = await execAsync(curlCommand);
      
      // Since we're using 2>&1, all output including verbose info will be in stdout
      await logger?.logToolExecution('ASR-NBest', 'Received curl output', {
        outputLength: stdout.length,
        outputPreview: stdout.substring(0, 200) + (stdout.length > 200 ? '...' : '')
      });
      
      // Extract JSON response from curl output
      // The response may have progress bars and other output mixed in
      // First, try to find a complete JSON object by looking for balanced braces
      let jsonResponse = '';
      
      // Try to extract JSON starting from the first { to the last }
      const firstBrace = stdout.indexOf('{');
      if (firstBrace === -1) {
        await logger?.logToolExecution('ASR-NBest', 'No JSON found in curl output', {
          stdout: stdout.substring(0, 500)
        });
        throw new Error(`No JSON response found in curl output: ${stdout}`);
      }
      
      // Find the matching closing brace by counting brace depth
      let braceDepth = 0;
      let inString = false;
      let escapeNext = false;
      let lastCloseBrace = -1;
      
      for (let i = firstBrace; i < stdout.length; i++) {
        const char = stdout[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              lastCloseBrace = i;
              break;
            }
          }
        }
      }
      
      if (lastCloseBrace === -1) {
        await logger?.logToolExecution('ASR-NBest', 'Could not find matching JSON braces', {
          preview: stdout.substring(firstBrace, Math.min(firstBrace + 500, stdout.length))
        });
        throw new Error(`Malformed JSON in curl output: ${stdout.substring(firstBrace, Math.min(firstBrace + 500, stdout.length))}...`);
      }
      
      jsonResponse = stdout.substring(firstBrace, lastCloseBrace + 1);
      
      // Clean up any control characters that might have been injected
      jsonResponse = jsonResponse.replace(/[\x00-\x1F\x7F]/g, (match) => {
        // Preserve valid JSON control characters
        if (match === '\n' || match === '\r' || match === '\t') {
          return match;
        }
        return '';
      });
      
      await logger?.logToolExecution('ASR-NBest', 'Processing ASR API response', {
        responseLength: jsonResponse.length
      });
      
      const parseResult = robustJsonParse(jsonResponse);
      if (!parseResult.success) {
        await logger?.logToolExecution('ASR-NBest', 'Failed to parse ASR response JSON', {
          error: parseResult.error,
          responsePreview: jsonResponse.substring(0, 500)
        });
        throw new Error(`Invalid ASR response format: ${parseResult.error}`);
      }
      const asrResult = parseResult.data;

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

      await logger?.logToolExecution('ASR-NBest', 'Parsed ASR API response structure', {
        hasText: !!asrResult.text,
        hasAlternatives: !!asrResult.alternatives,
        alternativesCount: asrResult.alternatives?.length || 0,
        hasError: !!asrResult.error,
        keys: Object.keys(asrResult),
        primaryText: result.primaryText.substring(0, 100) + (result.primaryText.length > 100 ? '...' : '')
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
        await logger?.logToolExecution('ASR-NBest', 'Saved results to debug file', {
          filepath: filepath.split('/').pop() || 'unknown'
        });
      } catch (saveError) {
        await logger?.logToolExecution('ASR-NBest', 'Failed to save debug file', {
          error: saveError instanceof Error ? saveError.message : saveError
        });
        // Don't throw - this is just for debugging, shouldn't break the main flow
      }

      return result;

    } catch (error) {
      await logger?.logToolExecution('ASR-NBest', 'Failed to get ASR alternatives', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error
      });
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