import { unlink } from 'fs/promises';
import { prisma } from '$lib/db/client';
import { createWriteStream, stat } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import type { EditorContent, FinAsrFinished, FinAsrResult, SectionType } from './api.d';
import { FIN_ASR_RESULTS_URL } from '$env/static/private';
// import { logger } from "../logging/client";

let finToEstFormat: (sucRes: FinAsrFinished) => EditorContent = function (sucRes: FinAsrFinished) {
	const result = {
		speakers: {
			S1: {
				name: 'S1'
			}
		},
		sections: [
			{
				start: 0,
				end: 0,
				type: 'non-speech' as SectionType
			}
		]
	};
	if (sucRes.result && sucRes.result.sections && sucRes.result.sections.length > 0) {
		result.sections = sucRes.result.sections.map((seg) => {
			return {
				start: seg.start,
				end: seg.end,
				type: 'speech' as SectionType,
				turns: [
					{
						start: seg.start,
						end: seg.end,
						speaker: 'S1',
						transcript: seg.transcript,
						unnormalized_transcript: seg.transcript,
						words: seg.words.map((w) => {
							return {
								confidence: 1,
								start: w.start + seg.start,
								end: w.end + seg.start,
								punctuation: '',
								word: w.word,
								word_with_punctuation: w.word
							};
						})
					}
				]
			};
		});
	}

	return result;
};
/* export const generatePeaks = async (fileId) => {
    const file = await prisma.file.findUnique({
        where: {
            id: fileId,
        },
    });
    let processFailed = false;
    const wavPath = file.path + ".wav";
    let peaksPath = file.path + ".json";
    // ffmpeg - i!{ audio_file } -f sox - | sox - t sox - -c 1 - b 16 - t wav audio.wav rate - v 16k
    const toWav = new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", ["-i", file.path, wavPath]);
        ffmpeg.on("exit", function (code) {
            console.log("ffmpeg finished with " + code);
            if (code === 1 || code == 2) {
                processFailed = true;
            }
            resolve(true);
        });
    });
    await toWav.catch((e) => processFailed = true);
    if (processFailed) {
        return false;
    }
    const peaksDone = new Promise((resolve, reject) => {
        const generatePeaks = spawn("audiowaveform", [
            "-i",
            wavPath,
            "-o",
            peaksPath,
            "--pixels-per-second",
            "1",
            "--bits",
            "8",
        ]);
        generatePeaks.on("exit", function (code) {
            console.log("generate peaks exited with code " + code);
            if (code === 1 || code == 2) {
                processFailed = true;
            }
            resolve(true);
        });
    });
    await peaksDone.catch((e) => processFailed = true);
    await fs.unlink(wavPath);
    if (processFailed) {
        return false;
    }
    const normalizeDone = new Promise((resolve, reject) => {
        const normalize = spawn("python", [
            "./scripts/normalize_peaks.py",
            peaksPath,
        ]);
        normalize.on("exit", function (code) {
            console.log("normalize exited with code " + code);
            resolve(true);
        });
    });
    await normalizeDone.catch((e) => console.log(e));
    return true;
}; */

export const checkCompletion = async (
	fileId: string,
	state: string,
	externalId: string,
	filePath: string,
	language: string,
	initialTranscriptionPath: string,
	fetch: Function
): Promise<{ done: boolean }> => {
	if (language === 'finnish') {
		const result = await fetch(FIN_ASR_RESULTS_URL, {
			method: 'POST',
			body: externalId
		}).catch(() => {
			console.error('Post failed to', FIN_ASR_RESULTS_URL, externalId);
			return { done: false };
		});
		if (!result) return { done: false };
		const body: FinAsrResult = await result.json();
		if (!body) return { done: false };
		if (!body.done) {
			return { done: false };
		} // Error case
		else if (body.error) {
			await prisma.file.update({
				data: { state: 'PROCESSING_ERROR' },
				where: {
					id: fileId
				}
			});
			console.log(
				`Failed to transcribe ${fileId}. Failed with code ${body.error.code}, ${body.error.message}`
			);
			await unlink(filePath);
			return { done: true };
		} else if (body) {
			const formatted = finToEstFormat(body);
			const text = JSON.stringify(formatted);

			// Ensure parent directory exists
			const parentDir = path.dirname(initialTranscriptionPath);
			try {
				await fs.mkdir(parentDir, { recursive: true });
			} catch (err) {
				console.error('Error creating directory:', err);
				await prisma.file.update({
					data: { state: 'PROCESSING_ERROR' },
					where: { id: fileId }
				});
				return { done: true };
			}

			const writeStream = createWriteStream(initialTranscriptionPath);
			writeStream.on('error', async (err) => {
				console.error('Error writing file:', err);
				await prisma.file.update({
					data: { state: 'PROCESSING_ERROR' },
					where: { id: fileId }
				});
			});
			writeStream.on('finish', async function () {
				await prisma.file.update({
					data: {
						initialTranscriptionPath,
						state: 'READY'
					},
					where: {
						id: fileId
					}
				});
			});
			writeStream.write(text);
			writeStream.end();
			// Pre-generate waveform peaks
			// await generatePeaks(fileId);
			return { done: true };
		}
	} else {
		return { done: true };
	}
};

export const getFiles = async (id) => {
	const user = await prisma.user.findUnique({
		where: {
			id: id
		},
		include: {
			files: {
				orderBy: {
					uploadedAt: 'desc'
				},
				select: {
					id: true,
					state: true,
					text: true,
					filename: true,
					duration: true,
					mimetype: true,
					uploadedAt: true,
					textTitle: true,
					initialTranscription: true,
					externalId: true,
					path: true,
					language: true,
					initialTranscriptionPath: true,
					autoAnalyze: true,
					workflows: {
						take: 1,
						select: {
							progressLength: true,
							succeededCount: true,
							processes: {
								select: {
									status: true
								}
							}
						}
					},
					transcriptCorrections: {
						where: {
							status: {
								in: ['pending', 'processing']
							}
						},
						select: {
							id: true,
							status: true
						}
					}
				}
			}
		}
	});
	if (user)
		return Promise.all(
			user.files.map(async (file) => {
				let progress = -1;
				let status = file.state;
				if (
					file.state !== 'READY' &&
					file.state !== 'ABORTED' &&
					file.state !== 'PROCESSING_ERROR'
				) {
					if (file.language === 'finnish') {
						await checkCompletion(
							file.id,
							file.state,
							file.externalId,
							file.path,
							file.language,
							file.initialTranscriptionPath,
							fetch
						);
					}
					if (file.workflows && file.workflows.length > 0 && file.workflows[0].processes) {
						progress = Math.floor((file.workflows[0].processes.length / 30) * 100);
					}
				}

				// Check if AI analysis is in progress
				const aiAnalysisInProgress = file.autoAnalyze && file.state === 'READY' &&
					file.transcriptCorrections && file.transcriptCorrections.length > 0;

				return {
					id: file.id,
					state: file.state,
					text: file.text,
					filename: file.filename,
					duration: file.duration?.toNumber(),
					mimetype: file.mimetype,
					uploadedAt: file.uploadedAt?.toString(),
					textTitle: file.textTitle,
					initialTranscription: file.initialTranscription,
					externalId: file.externalId,
					path: file.path,
					language: file.language,
					userId: user.id,
					autoAnalyze: file.autoAnalyze,
					aiAnalysisInProgress,
					progress
				};
			})
		);
	else return [];
};
