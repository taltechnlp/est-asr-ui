import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { TranscriptAnalysisTool } from './base';
import { robustJsonParse } from '../utils/jsonParser';
import { getCurrentLogger } from '../../utils/agentFileLogger';

const execAsync = promisify(exec);

const SignalQualitySchema = z.object({
	audioFilePath: z.string().describe('Path to the full audio file'),
	startTime: z.number().describe('Start time in seconds'),
	endTime: z.number().describe('End time in seconds')
});

export interface SignalQualityResult {
	snr_db: number;
	quality_category: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor' | 'unknown';
	reliability: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
	suggested_confidence_threshold: number;
	method: 'torchmetrics' | 'fallback' | 'librosa_fallback' | 'error_fallback';
	duration: number | null;
	sample_rate: number | null;
	segment_info: {
		start_time: number;
		end_time: number;
		duration: number | null;
	};
	peak_amplitude?: number;
	rms_energy?: number;
	dynamic_range_db?: number;
	zero_crossing_rate?: number;
	spectral_centroid_mean?: number;
	spectral_centroid_std?: number;
	is_clipped?: boolean;
	clipping_ratio?: number;
	error?: string;
}

/**
 * Signal Quality Assessor Tool for Audio Quality Analysis
 *
 * This tool provides audio signal quality assessment as specified in theory.md:
 * - Calculates Signal-to-Noise Ratio (SNR) using TorchMetrics
 * - Provides quality categories and reliability assessments
 * - Suggests dynamic confidence thresholds based on audio quality
 * - Helps guide ASR error correction strategy based on signal quality
 *
 * Uses PyTorch and TorchMetrics for accurate SNR calculation via Python subprocess.
 */
export class SignalQualityAssessorTool extends TranscriptAnalysisTool {
	private scriptPath: string;
	private pythonCommand: string;
	private isAvailable: boolean = true;
	private useDocker: boolean = false;
	private dockerContainerName: string = 'est-asr-python-tools';

	constructor(pythonCommand: string = 'python3', scriptPath?: string) {
		super(
			'signal_quality_assessor',
			`Analyzes audio signal quality to guide ASR error correction strategy.
      
This tool calculates Signal-to-Noise Ratio (SNR) and other audio quality metrics to help determine:
- How aggressive the error correction should be (low SNR = more aggressive)
- Confidence thresholds for applying corrections (high SNR = higher threshold)
- Reliability of ASR output for the given audio segment
- Overall audio quality assessment

Key insights:
- High SNR (>30dB): Conservative correction, high confidence threshold required
- Medium SNR (15-30dB): Balanced approach, moderate confidence threshold
- Low SNR (<15dB): Aggressive correction, lower confidence threshold due to likely errors

The tool is particularly effective for adapting correction behavior to audio conditions,
preventing over-correction on clean audio while catching more errors in noisy segments.

Input: Audio file path with start and end timestamps
Output: Comprehensive signal quality analysis including SNR, quality category, and suggested thresholds`,
			SignalQualitySchema,
			(input: any) => this._call(input)
		);

		this.pythonCommand = pythonCommand;
		this.scriptPath = scriptPath || join(process.cwd(), 'scripts', 'signal_quality_assessor.py');

		// Initialization logging moved to file logger when assessment starts

		// Test availability on initialization (don't await in constructor)
		// First check for Docker, then fallback to system Python
		this.testAvailability().catch(() => {
			this.isAvailable = false;
		});
	}

	private async testAvailability(): Promise<void> {
		// First, try Docker-based execution
		try {
			const dockerTestCommand = `docker compose -f docker-compose.python.yml exec -T ${this.dockerContainerName} python -c "import sys; import json; import torch; import torchmetrics; print(json.dumps({'test': 'ok', 'enhanced': True}))"`;
			const { stdout } = await execAsync(dockerTestCommand);
			
			const parseResult = robustJsonParse(stdout);
			if (parseResult.success) {
				this.useDocker = true;
				this.isAvailable = true;
				return;
			}
		} catch (error) {
			// Docker not available or container not running, continue to system Python test
		}

		// Fallback to system Python
		try {
			const testCommand = `${this.pythonCommand} -c "import sys; import json; print(json.dumps({'test': 'ok', 'enhanced': False}))"`;
			const { stdout, stderr } = await execAsync(testCommand);

			const parseResult = robustJsonParse(stdout);
			if (parseResult.success) {
				this.useDocker = false;
				this.isAvailable = true;
			} else {
				this.isAvailable = false;
			}
		} catch (error) {
			this.isAvailable = false;
		}
	}

	async _call(input: z.infer<typeof SignalQualitySchema>): Promise<string> {
		const result = await this.assessSignalQuality(input);
		return JSON.stringify(result);
	}

	/**
	 * Assess audio signal quality for the given segment
	 */
	async assessSignalQuality(
		input: z.infer<typeof SignalQualitySchema>
	): Promise<SignalQualityResult> {
		const { audioFilePath, startTime, endTime } = input;
		const logger = getCurrentLogger();

		await logger?.logToolExecution('SignalQualityAssessor', 'Starting signal quality assessment', {
			audioFile: audioFilePath ? audioFilePath.split('/').pop() : 'unknown',
			startTime,
			endTime,
			duration: (endTime - startTime).toFixed(3) + 's'
		});

		if (!this.isAvailable) {
			await logger?.logToolExecution(
				'SignalQualityAssessor',
				'Tool not available, using fallback result'
			);
			return this.createFallbackResult(audioFilePath, startTime, endTime);
		}

		try {
			// Validate inputs
			if (!audioFilePath || audioFilePath.trim() === '') {
				await logger?.logToolExecution(
					'SignalQualityAssessor',
					'No audio file path provided, using fallback result'
				);
				return this.createFallbackResult(audioFilePath || 'unknown', startTime, endTime);
			}

			if (startTime < 0) {
				throw new Error(`Invalid startTime: ${startTime} (must be >= 0)`);
			}

			if (endTime <= startTime) {
				throw new Error(
					`Invalid time range: endTime (${endTime}s) must be greater than startTime (${startTime}s)`
				);
			}

			const duration = endTime - startTime;

			// Escape file path for shell execution
			const escapedPath = audioFilePath.replace(/"/g, '\\"');

			// Build command based on whether Docker is available
			let command: string;
			if (this.useDocker) {
				// Use Docker container execution
				command = `docker compose -f docker-compose.python.yml exec -T ${this.dockerContainerName} python /app/scripts/signal_quality_assessor.py assess "${escapedPath}" ${startTime} ${endTime}`;
			} else {
				// Use system Python
				command = `${this.pythonCommand} "${this.scriptPath}" assess "${escapedPath}" ${startTime} ${endTime}`;
			}

			await logger?.logToolExecution(
				'SignalQualityAssessor',
				`Executing quality assessment command ${this.useDocker ? '(Docker)' : '(System Python)'}`,
				{
					command: command.replace(this.scriptPath, '[script]').replace(audioFilePath, '[audio]'),
					duration: duration.toFixed(3) + 's',
					useDocker: this.useDocker
				}
			);

			const { stdout, stderr } = await execAsync(command, {
				timeout: 30000, // 30 second timeout for audio processing
				maxBuffer: 1024 * 1024 // 1MB buffer
			});

			if (stderr) {
				await logger?.logToolExecution(
					'SignalQualityAssessor',
					'Python script generated warnings',
					{
						warnings: stderr
					}
				);
			}

			await logger?.logToolExecution('SignalQualityAssessor', 'Received Python output', {
				outputLength: stdout.length
			});

			// Parse the JSON response
			const parseResult = robustJsonParse(stdout);
			if (!parseResult.success) {
				await logger?.logToolExecution('SignalQualityAssessor', 'Failed to parse JSON response', {
					error: parseResult.error,
					rawOutput: stdout.substring(0, 500)
				});
				throw new Error(`Invalid signal quality response: ${parseResult.error}`);
			}

			const result = parseResult.data as SignalQualityResult;

			// Validate the response structure
			if (typeof result.snr_db !== 'number') {
				throw new Error('Invalid response: missing or invalid snr_db');
			}

			await logger?.logToolExecution('SignalQualityAssessor', 'Assessment completed successfully', {
				snrDb: result.snr_db,
				qualityCategory: result.quality_category,
				reliability: result.reliability,
				suggestedThreshold: result.suggested_confidence_threshold,
				method: result.method,
				peakAmplitude: result.peak_amplitude || null,
				isClipped: result.is_clipped || false,
				clippingRatio: result.clipping_ratio || 0
			});

			return result;
		} catch (error) {
			await logger?.logToolExecution('SignalQualityAssessor', 'Assessment failed with error', {
				error: error instanceof Error ? { message: error.message, stack: error.stack } : error
			});

			// Return fallback result instead of throwing
			await logger?.logToolExecution(
				'SignalQualityAssessor',
				'Returning fallback result due to error'
			);
			return this.createFallbackResult(audioFilePath, startTime, endTime);
		}
	}

	/**
	 * Create a fallback result when the Python script is not available
	 */
	private createFallbackResult(
		audioFilePath: string,
		startTime: number,
		endTime: number
	): SignalQualityResult {
		const duration = endTime - startTime;

		// Estimate quality based on duration and common patterns
		let estimatedSNR = 15.0; // Default moderate
		let qualityCategory: SignalQualityResult['quality_category'] = 'unknown';
		let reliability: SignalQualityResult['reliability'] = 'medium';

		// Very short segments are often more error-prone
		if (duration < 1.0) {
			estimatedSNR = 12.0;
			qualityCategory = 'poor';
			reliability = 'low';
		} else if (duration > 10.0) {
			// Longer segments often have more variation
			estimatedSNR = 18.0;
			qualityCategory = 'fair';
			reliability = 'medium';
		}

		return {
			snr_db: estimatedSNR,
			quality_category: qualityCategory,
			reliability: reliability,
			suggested_confidence_threshold: 0.7,
			method: 'error_fallback',
			duration: duration,
			sample_rate: null,
			segment_info: {
				start_time: startTime,
				end_time: endTime,
				duration: duration
			},
			error: 'Audio analysis tools not available'
		};
	}

	/**
	 * Assess quality of an entire audio file (no segmentation)
	 */
	async assessFileQuality(audioFilePath: string): Promise<SignalQualityResult> {
		if (!this.isAvailable) {
			return this.createFallbackResult(audioFilePath, 0, 10); // Assume 10s file
		}

		try {
			const escapedPath = audioFilePath.replace(/"/g, '\\"');
			
			// Build command based on whether Docker is available
			let command: string;
			if (this.useDocker) {
				// Use Docker container execution
				command = `docker compose -f docker-compose.python.yml exec -T ${this.dockerContainerName} python /app/scripts/signal_quality_assessor.py assess_file "${escapedPath}"`;
			} else {
				// Use system Python
				command = `${this.pythonCommand} "${this.scriptPath}" assess_file "${escapedPath}"`;
			}

			const { stdout } = await execAsync(command, { timeout: 60000 }); // 1 minute for full file
			const parseResult = robustJsonParse(stdout);

			if (parseResult.success) {
				return parseResult.data;
			}

			throw new Error('Invalid assess_file response');
		} catch (error) {
			// File quality assessment failed, using fallback
			return this.createFallbackResult(audioFilePath, 0, 10);
		}
	}

	/**
	 * Get quality assessment category and suggested behavior
	 */
	getAnalysisStrategy(snrDb: number): {
		strategy: 'conservative' | 'balanced' | 'aggressive' | 'very_aggressive';
		confidenceThreshold: number;
		description: string;
	} {
		if (snrDb >= 30) {
			return {
				strategy: 'conservative',
				confidenceThreshold: 0.9,
				description: 'Excellent audio quality - be very conservative with corrections'
			};
		} else if (snrDb >= 20) {
			return {
				strategy: 'balanced',
				confidenceThreshold: 0.8,
				description: 'Good audio quality - use balanced correction approach'
			};
		} else if (snrDb >= 15) {
			return {
				strategy: 'balanced',
				confidenceThreshold: 0.7,
				description: 'Fair audio quality - moderate correction threshold'
			};
		} else if (snrDb >= 10) {
			return {
				strategy: 'aggressive',
				confidenceThreshold: 0.6,
				description: 'Poor audio quality - be more aggressive with corrections'
			};
		} else {
			return {
				strategy: 'very_aggressive',
				confidenceThreshold: 0.5,
				description: 'Very poor audio quality - apply corrections aggressively'
			};
		}
	}

	/**
	 * Check if the tool is available and working
	 */
	isToolAvailable(): boolean {
		return this.isAvailable;
	}
}

/**
 * Factory function to create a SignalQualityAssessorTool instance
 */
export function createSignalQualityAssessorTool(
	pythonCommand?: string,
	scriptPath?: string
): SignalQualityAssessorTool {
	return new SignalQualityAssessorTool(pythonCommand, scriptPath);
}
