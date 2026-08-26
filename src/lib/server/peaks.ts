import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { prisma } from '$lib/db/client';

/**
 * Server-side waveform peaks for peaks.js.
 *
 * The browser used to download the whole media file and decode it with
 * `decodeAudioData` just to draw the waveform. For a 2 h recording that is
 * >100 MB of download and >1 GB of PCM in RAM, which stalls desktop browsers
 * and is impossible on mobile. Instead we render a compact binary peaks file
 * once (`ffmpeg | audiowaveform`, ~1–2 s per hour of audio, ~400 KB output)
 * and let peaks.js load that via `dataUri`.
 */

/** Sample rate the audio is resampled to before peak extraction. */
const PEAKS_SAMPLE_RATE = 16000;
/** Samples per pixel of the stored data; peaks.js zoom levels must be >= this. */
export const PEAKS_SCALE = 512;

export const peaksPathFor = (mediaPath: string) => `${mediaPath}.peaks.dat`;

const inFlight = new Map<string, Promise<string>>();

const exists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);

function runPipeline(mediaPath: string, outPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		// Decode any container/codec to 16 kHz mono WAV on stdout, and let
		// audiowaveform read that from stdin.
		const ffmpeg = spawn('ffmpeg', [
			'-hide_banner',
			'-loglevel',
			'error',
			'-nostdin',
			'-i',
			mediaPath,
			'-vn',
			'-ac',
			'1',
			'-ar',
			String(PEAKS_SAMPLE_RATE),
			'-f',
			'wav',
			'-'
		]);
		const aw = spawn('audiowaveform', [
			'--input-format',
			'wav',
			'--output-format',
			'dat',
			'-i',
			'-',
			'-o',
			outPath,
			'-z',
			String(PEAKS_SCALE),
			'-b',
			'8',
			'-q'
		]);

		let stderr = '';
		ffmpeg.stderr.on('data', (d) => (stderr += d));
		aw.stderr.on('data', (d) => (stderr += d));

		ffmpeg.stdout.pipe(aw.stdin);
		// audiowaveform closing early (error) must not crash us with EPIPE.
		aw.stdin.on('error', () => ffmpeg.kill('SIGKILL'));
		ffmpeg.stdout.on('error', () => {});

		ffmpeg.on('error', reject);
		aw.on('error', (err) => {
			ffmpeg.kill('SIGKILL');
			reject(err);
		});
		ffmpeg.on('exit', (code) => {
			if (code !== 0) aw.kill('SIGKILL');
		});
		aw.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`audiowaveform exited with ${code}: ${stderr.trim()}`));
		});
	});
}

/**
 * Returns the path of the peaks file for `mediaPath`, generating it if needed.
 * Concurrent calls for the same media share one generation.
 */
export async function ensurePeaks(mediaPath: string): Promise<string> {
	const outPath = peaksPathFor(mediaPath);
	if (await exists(outPath)) return outPath;

	const pending = inFlight.get(outPath);
	if (pending) return pending;

	const job = (async () => {
		const tmp = `${outPath}.${process.pid}.tmp.dat`;
		try {
			await runPipeline(mediaPath, tmp);
			await fs.rename(tmp, outPath);
			return outPath;
		} catch (err) {
			await fs.rm(tmp, { force: true }).catch(() => {});
			throw err;
		} finally {
			inFlight.delete(outPath);
		}
	})();
	inFlight.set(outPath, job);
	return job;
}

/**
 * Fire-and-forget pre-generation, for use when a file becomes READY so the
 * first editor open does not have to wait.
 */
export function pregeneratePeaks(fileId: string): void {
	prisma.file
		.findUnique({ where: { id: fileId }, select: { path: true } })
		.then((file) => (file?.path ? ensurePeaks(file.path) : undefined))
		.catch((err) => console.error(`Peaks pre-generation failed for ${fileId}:`, err));
}
