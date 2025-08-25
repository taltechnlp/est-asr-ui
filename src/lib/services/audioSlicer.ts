import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SECRET_UPLOAD_DIR } from '$env/static/private';
import { getCurrentLogger } from '$lib/utils/agentFileLogger';

export interface AudioSliceOptions {
	startTime: number; // in seconds
	endTime: number; // in seconds
	format?: 'mp3' | 'wav' | 'flac'; // output format
}

export interface AudioSliceResult {
	tempFilePath: string;
	duration: number;
	cleanup: () => Promise<void>;
}

export class AudioSlicer {
	private tempDir: string;

	constructor() {
		// Create temp directory for sliced audio files
		this.tempDir = path.join(SECRET_UPLOAD_DIR, 'temp');
	}

	async ensureTempDir(): Promise<void> {
		try {
			await fs.mkdir(this.tempDir, { recursive: true });
		} catch (error) {
			const logger = getCurrentLogger();
			if (logger) {
				await logger.logGeneral('error', 'Failed to create temp directory', { error });
			}
		}
	}

	async sliceAudio(inputPath: string, options: AudioSliceOptions): Promise<AudioSliceResult> {
		await this.ensureTempDir();

		const { startTime, endTime, format = 'mp3' } = options;
		const duration = endTime - startTime;

		// Log slicing parameters
		const logger = getCurrentLogger();
		if (logger) {
			await logger.logToolExecution('AudioSlicer', 'Slicing audio file', {
				inputPath: path.basename(inputPath),
				startTime: startTime.toFixed(3),
				endTime: endTime.toFixed(3),
				duration: duration.toFixed(3),
				format
			});
		}

		// Validate parameters
		if (duration <= 0) {
			throw new Error(`Invalid duration: ${duration}s (endTime must be greater than startTime)`);
		}

		// Generate unique filename for temp file
		const tempFileName = `slice_${uuidv4()}.${format}`;
		const tempFilePath = path.join(this.tempDir, tempFileName);

		const startTimeMs = Date.now();

		return new Promise((resolve, reject) => {
			// Build ffmpeg command
			// -ss: start time (before -i for faster seeking)
			// -t: duration
			// -i: input file
			// For WAV format, use PCM codec explicitly for better compatibility
			// -y: overwrite output file
			const args =
				format === 'wav'
					? [
							'-ss',
							startTime.toString(),
							'-t',
							duration.toString(),
							'-i',
							inputPath,
							'-acodec',
							'pcm_s16le', // 16-bit PCM for WAV
							'-ar',
							'16000', // 16kHz sample rate for ASR
							'-ac',
							'1', // Mono
							'-y',
							tempFilePath
						]
					: [
							'-ss',
							startTime.toString(),
							'-t',
							duration.toString(),
							'-i',
							inputPath,
							'-c',
							'copy',
							'-y',
							tempFilePath
						];

			if (logger) {
				await logger.logToolExecution('AudioSlicer', 'Running ffmpeg', {
					args: args.join(' ').replace(inputPath, path.basename(inputPath))
				});
			}

			const ffmpeg = spawn('ffmpeg', args);

			let stderr = '';

			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			ffmpeg.on('error', (error) => {
				reject(new Error(`FFmpeg spawn error: ${error.message}`));
			});

			ffmpeg.on('exit', async (code) => {
				const elapsedMs = Date.now() - startTimeMs;

				if (code === 0) {
					// Verify file was created
					try {
						await fs.access(tempFilePath);
						const stats = await fs.stat(tempFilePath);

						if (logger) {
							await logger.logToolExecution('AudioSlicer', 'Slice completed successfully', {
								tempFilePath: path.basename(tempFilePath),
								fileSize: stats.size,
								duration: duration.toFixed(3),
								elapsedMs,
								elapsedSeconds: (elapsedMs / 1000).toFixed(3)
							});
						}

						resolve({
							tempFilePath,
							duration,
							cleanup: async () => {
								try {
									await fs.unlink(tempFilePath);
									const logger = getCurrentLogger();
									if (logger) {
										await logger.logToolExecution('AudioSlicer', 'Cleaned up temp file', {
											tempFilePath: path.basename(tempFilePath)
										});
									}
								} catch (error) {
									const logger = getCurrentLogger();
									if (logger) {
										await logger.logGeneral('error', 'Failed to cleanup temp file', { error });
									}
								}
							}
						});
					} catch (error) {
						if (logger) {
							await logger.logGeneral('error', 'AudioSlicer output file verification failed', {
								tempFilePath: path.basename(tempFilePath),
								error
							});
						}
						reject(new Error('Output file was not created'));
					}
				} else {
					if (logger) {
						await logger.logGeneral('error', 'AudioSlicer FFmpeg failed', {
							exitCode: code,
							elapsedMs,
							stderr: stderr.substring(stderr.length - 1000) // Last 1000 chars of stderr
						});
					}
					reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
				}
			});
		});
	}

	async sliceAudioWithQuality(
		inputPath: string,
		options: AudioSliceOptions & { quality?: 'low' | 'medium' | 'high' }
	): Promise<AudioSliceResult> {
		await this.ensureTempDir();

		const { startTime, endTime, format = 'mp3', quality = 'medium' } = options;
		const duration = endTime - startTime;

		const tempFileName = `slice_${uuidv4()}.${format}`;
		const tempFilePath = path.join(this.tempDir, tempFileName);

		// Quality presets for different formats
		const qualityPresets = {
			mp3: {
				low: ['-b:a', '64k'],
				medium: ['-b:a', '128k'],
				high: ['-b:a', '192k']
			},
			wav: {
				low: ['-ar', '16000', '-ac', '1'],
				medium: ['-ar', '22050', '-ac', '1'],
				high: ['-ar', '44100', '-ac', '2']
			},
			flac: {
				low: ['-compression_level', '0'],
				medium: ['-compression_level', '5'],
				high: ['-compression_level', '8']
			}
		};

		return new Promise((resolve, reject) => {
			const args = [
				'-ss',
				startTime.toString(),
				'-t',
				duration.toString(),
				'-i',
				inputPath,
				...qualityPresets[format][quality],
				'-y',
				tempFilePath
			];

			const ffmpeg = spawn('ffmpeg', args);

			let stderr = '';

			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});

			ffmpeg.on('error', (error) => {
				reject(new Error(`FFmpeg spawn error: ${error.message}`));
			});

			ffmpeg.on('exit', async (code) => {
				if (code === 0) {
					try {
						const stats = await fs.stat(tempFilePath);

						resolve({
							tempFilePath,
							duration,
							cleanup: async () => {
								try {
									await fs.unlink(tempFilePath);
								} catch (error) {
									const logger = getCurrentLogger();
									if (logger) {
										await logger.logGeneral('error', 'Failed to cleanup temp file', { error });
									}
								}
							}
						});
					} catch (error) {
						reject(new Error('Output file was not created'));
					}
				} else {
					reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
				}
			});
		});
	}

	// Clean up old temp files (run periodically)
	async cleanupOldFiles(maxAgeHours: number = 1): Promise<void> {
		try {
			const files = await fs.readdir(this.tempDir);
			const now = Date.now();
			const maxAge = maxAgeHours * 60 * 60 * 1000;

			for (const file of files) {
				const filePath = path.join(this.tempDir, file);
				const stats = await fs.stat(filePath);

				if (now - stats.mtimeMs > maxAge) {
					await fs.unlink(filePath);
					const logger = getCurrentLogger();
					if (logger) {
						await logger.logToolExecution('AudioSlicer', 'Cleaned up old temp file', { file });
					}
				}
			}
		} catch (error) {
			const logger = getCurrentLogger();
			if (logger) {
				await logger.logGeneral('error', 'Error cleaning up temp files', { error });
			}
		}
	}
}

// Singleton instance
let audioSlicerInstance: AudioSlicer | null = null;

export function getAudioSlicer(): AudioSlicer {
	if (!audioSlicerInstance) {
		audioSlicerInstance = new AudioSlicer();
	}
	return audioSlicerInstance;
}
