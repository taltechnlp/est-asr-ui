import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SECRET_UPLOAD_DIR } from '$env/static/private';

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
      console.error('Failed to create temp directory:', error);
    }
  }

  async sliceAudio(
    inputPath: string,
    options: AudioSliceOptions
  ): Promise<AudioSliceResult> {
    await this.ensureTempDir();

    const { startTime, endTime, format = 'mp3' } = options;
    const duration = endTime - startTime;
    
    // Generate unique filename for temp file
    const tempFileName = `slice_${uuidv4()}.${format}`;
    const tempFilePath = path.join(this.tempDir, tempFileName);

    return new Promise((resolve, reject) => {
      // Build ffmpeg command
      // -ss: start time
      // -t: duration
      // -i: input file
      // -c copy: copy codec (fast, no re-encoding)
      // -y: overwrite output file
      const args = [
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputPath,
        '-c', 'copy',
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
          // Verify file was created
          try {
            await fs.access(tempFilePath);
            
            resolve({
              tempFilePath,
              duration,
              cleanup: async () => {
                try {
                  await fs.unlink(tempFilePath);
                } catch (error) {
                  console.error('Failed to cleanup temp file:', error);
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
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputPath,
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
                  console.error('Failed to cleanup temp file:', error);
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
          console.log(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
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