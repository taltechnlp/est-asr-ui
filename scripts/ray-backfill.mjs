#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const prisma = new PrismaClient();
const RAY_JOB_ID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RAY_BACKFILL_MARKER = 'ray-backfill:';

const args = new Map(
	process.argv.slice(2).map((arg) => {
		const [key, ...rest] = arg.replace(/^--/, '').split('=');
		return [key, rest.length ? rest.join('=') : 'true'];
	})
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseEnvValue = (raw) => {
	const trimmed = raw.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
	}
	return trimmed;
};

const loadEnv = async (envPath) => {
	const text = await readFile(envPath, 'utf8');
	const env = {};
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
		const index = trimmed.indexOf('=');
		env[trimmed.slice(0, index)] = parseEnvValue(trimmed.slice(index + 1));
	}
	return env;
};

const env = await loadEnv(ENV_PATH);
const rayBaseUrl = (env.ASR_RAY_URL || '').replace(/\/+$/, '');
const rayToken = env.ASR_RAY_TOKEN || '';
const resultsDir = env.RESULTS_DIR || '/slurm-share/results';
const origin = env.ORIGIN || 'https://tekstiks.ee';

if (!rayBaseUrl) throw new Error('ASR_RAY_URL is missing');
if (!rayToken) throw new Error('ASR_RAY_TOKEN is missing');

const submitDelayMs = Number(args.get('submit-delay-ms') || 1000);
const pollIntervalMs = Number(args.get('interval-ms') || 60000);
const once = args.has('once');
const submitUploaded = args.get('submit-uploaded') !== 'false';
const monitor = args.get('monitor') !== 'false';
const stateFile = args.get('state-file') || path.join(ROOT, '.ray-backfill-state.json');

const authHeaders = () => ({ Authorization: `Bearer ${rayToken}` });

const loadState = async () => {
	try {
		return JSON.parse(await readFile(stateFile, 'utf8'));
	} catch {
		return { submitted: {} };
	}
};

const state = await loadState();
state.submitted ||= {};

const saveState = async () => {
	await writeFile(stateFile, JSON.stringify(state, null, 2));
};

const createEmail = (text) => `
  <div className="email" style="
    border: 1px solid black;
    padding: 20px;
    font-family: sans-serif;
    line-height: 2;
    font-size: 20px;
  ">
    <h2>Tere!</h2>
    <p>${text}</p>

    <p><a href="${origin}">Tekstiks.ee</a>,</p>
    <p>Aivo Olev</p>
    <p><a href = "mailto:konetuvastus@taltech.ee?subject= Kontoga seotud küsimus">konetuvastus@taltech.ee</a></p>
  </div>
`;

const sendEmail = async ({ to, subject, html }) => {
	console.log(`Sending email to ${to}`);
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: Number(env.SMTP_PORT || 587),
		secure: false,
		auth: {
			user: env.SMTP_USER,
			pass: env.SMTP_PASSWORD
		},
		tls: {
			ciphers: 'SSLv3',
			rejectUnauthorized: true
		},
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 10000,
		from: {
			name: 'Tekstiks.ee',
			address: env.SMTP_FROM
		},
		replyTo: env.SMTP_REPLYTO
	});
	const result = await Promise.race([
		transporter.sendMail({
			from: env.SMTP_FROM,
			to,
			subject,
			html
		}),
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Email sending timeout')), 30000)
		)
	]);
	console.log(`Email sent: ${result.messageId}`);
};

const sendRayCompletionEmail = async (fileId, success) => {
	try {
		const file = await prisma.file.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				filename: true,
				notify: true,
				notified: true,
				User: { select: { email: true } }
			}
		});
		if (!file || !file.notify || file.notified || !file.User?.email) return;
		if (success) {
			await sendEmail({
				to: file.User.email,
				subject: 'Transkribeerimine õnnestus - tekstiks.ee',
				html: createEmail(`Teie faili nimega ${file.filename} transkribeerimine õnnestus!

                <a href="${origin}/files/${file.id}">Tuvastatud tekst asub siin.</a>`)
			});
		} else {
			await sendEmail({
				to: file.User.email,
				subject: 'Transkribeerimine ebaõnnestus - tekstiks.ee',
				html: createEmail(`Teenusel tekstiks.ee ei õnnestunud teie faili paraku transkribeerida.

                Rikete kohta võib infot saada kasutajatoelt, kirjutades konetuvastus@taltech.ee aadressile.

                <a href="${origin}/files">Klõpsa siia, et tutvuda oma ülesse laaditud failidega.</a>`)
			});
		}
		await prisma.file.update({
			data: { notified: true },
			where: { id: fileId }
		});
	} catch (error) {
		console.error(`Failed to send Ray completion email for ${fileId}`, error);
	}
};

const stripTrailingPunct = (word) => {
	const stripped = word.replace(/[.,;:!?…""\u201c\u201d\u2019\u2018\-)]+$/u, '');
	const punctuation = word.slice(stripped.length);
	return { word: stripped || word, punctuation: stripped ? punctuation : '' };
};

const toConfidence = (rayWord) => {
	if (typeof rayWord.ctc_conf === 'number') return rayWord.ctc_conf;
	if (typeof rayWord.probability === 'number') return rayWord.probability;
	if (typeof rayWord.entropy_conf === 'number') return rayWord.entropy_conf;
	return 1;
};

const mapWord = (rayWord) => {
	const raw = rayWord.word_with_punctuation ?? rayWord.word ?? '';
	const wordBase = rayWord.word ?? stripTrailingPunct(raw).word;
	const punctuation = rayWord.punctuation ?? stripTrailingPunct(raw).punctuation;
	return {
		confidence: toConfidence(rayWord),
		start: rayWord.start,
		end: rayWord.end,
		punctuation,
		word: wordBase,
		word_with_punctuation: raw || wordBase
	};
};

const rayResponseToEditorContent = (resp) => {
	const speakers = {};
	const sections = [];

	if (!resp.segments || resp.segments.length === 0) {
		return {
			speakers: { S1: { name: 'S1' } },
			sections: [{ start: 0, end: 0, type: 'non-speech' }]
		};
	}

	for (const segment of resp.segments) {
		const speakerId = segment.speaker || 'SPEAKER_00';
		if (!speakers[speakerId]) {
			speakers[speakerId] = { name: speakerId };
		}
		const words = (segment.words ?? []).map(mapWord);
		sections.push({
			start: segment.start,
			end: segment.end,
			type: 'speech',
			turns: [
				{
					start: segment.start,
					end: segment.end,
					speaker: speakerId,
					transcript: segment.text,
					unnormalized_transcript: segment.text,
					words
				}
			]
		});
	}

	return { speakers, sections };
};

const writeEditorContent = async (targetPath, content) => {
	await mkdir(path.dirname(targetPath), { recursive: true });
	await writeFile(targetPath, JSON.stringify(content));
};

const requestJson = async (url, options = {}) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), Number(args.get('http-timeout-ms') || 120000));
	try {
		const response = await fetch(url, { ...options, signal: controller.signal });
		const text = await response.text();
		let body = null;
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				body = { raw: text };
			}
		}
		return { response, body };
	} finally {
		clearTimeout(timeout);
	}
};

const submitRayJob = async (filePath) => {
	const { response, body } = await requestJson(`${rayBaseUrl}/jobs`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders()
		},
		body: JSON.stringify({
			input_audio_path: filePath,
			diarization: true,
			forced_alignment: true,
			fa_method: 'xlsr',
			whisper_language: 'et'
		})
	});
	if (!response.ok || !body?.job_id) {
		throw new Error(`Ray /jobs returned ${response.status}: ${JSON.stringify(body)}`);
	}
	return body.job_id;
};

const getRayJobStatus = async (jobId) => {
	const { response, body } = await requestJson(`${rayBaseUrl}/jobs/${encodeURIComponent(jobId)}`, {
		headers: authHeaders()
	});
	if (!response.ok) {
		throw new Error(`Ray /jobs/${jobId} returned ${response.status}: ${JSON.stringify(body)}`);
	}
	return body;
};

const isEstonian = (language) => language === 'estonian' || language === 'est';

const resultPathForFile = (file) =>
	file.initialTranscriptionPath ||
	path.join(resultsDir, file.uploader || 'unknown', file.id, 'result.json');

const markMissingAudio = async (file) => {
	console.error(`Audio path missing for ${file.id}: ${file.path}`);
	await prisma.file.update({
		where: { id: file.id },
		data: { state: 'PROCESSING_ERROR' }
	});
	await sendRayCompletionEmail(file.id, false);
};

const submitQueuedFiles = async () => {
	const queued = await prisma.file.findMany({
		where: {
			AND: [
				{ OR: [{ language: 'estonian' }, { language: 'est' }] },
				{
					OR: [
						{ state: 'UPLOADED' },
						{
							state: 'PROCESSING',
							externalId: { startsWith: RAY_BACKFILL_MARKER }
						}
					]
				}
			]
		},
		select: {
			id: true,
			state: true,
			externalId: true,
			path: true,
			language: true,
			uploader: true,
			initialTranscriptionPath: true,
			filename: true
		},
		orderBy: { uploadedAt: 'asc' }
	});

	for (const file of queued) {
		if (!isEstonian(file.language)) continue;
		const marker = `${RAY_BACKFILL_MARKER}${Date.now()}`;
		const claim = await prisma.file.updateMany({
			where: {
				id: file.id,
				OR: [
					{ state: 'UPLOADED' },
					{
						state: 'PROCESSING',
						externalId: { startsWith: RAY_BACKFILL_MARKER }
					}
				]
			},
			data: { state: 'PROCESSING', externalId: marker }
		});
		if (claim.count !== 1) continue;

		if (!existsSync(file.path)) {
			await markMissingAudio(file);
			continue;
		}

		try {
			const jobId = await submitRayJob(file.path);
			await prisma.file.update({
				where: { id: file.id },
				data: {
					state: 'PROCESSING',
					externalId: jobId,
					initialTranscriptionPath: resultPathForFile(file)
				}
			});
			state.submitted[file.id] = jobId;
			await saveState();
			console.log(`Submitted ${file.id} to Ray as ${jobId} (${file.filename})`);
		} catch (error) {
			console.error(`Failed to submit ${file.id} to Ray`, error);
			await prisma.file.update({
				where: { id: file.id },
				data: { state: 'UPLOADED', externalId: file.externalId }
			});
		}
		await sleep(submitDelayMs);
	}

	return queued.length;
};

const monitorRayFiles = async () => {
	const submittedIds = Object.keys(state.submitted || {});
	if (submittedIds.length === 0) {
		return 0;
	}

	const files = await prisma.file.findMany({
		where: {
			id: { in: submittedIds },
			state: 'PROCESSING',
			OR: [{ language: 'estonian' }, { language: 'est' }]
		},
		select: {
			id: true,
			externalId: true,
			path: true,
			language: true,
			initialTranscriptionPath: true,
			uploader: true
		},
		orderBy: { uploadedAt: 'asc' }
	});

	let pending = 0;
	for (const file of files) {
		if (!file.externalId || file.externalId.startsWith(RAY_BACKFILL_MARKER)) {
			pending += 1;
			continue;
		}
		if (!RAY_JOB_ID_RE.test(file.externalId)) continue;

		let status;
		try {
			status = await getRayJobStatus(file.externalId);
		} catch (error) {
			if (String(error?.message || error).includes('returned 404')) {
				await prisma.file.update({
					where: { id: file.id },
					data: { state: 'PROCESSING_ERROR' }
				});
				await sendRayCompletionEmail(file.id, false);
				delete state.submitted[file.id];
				await saveState();
				console.error(`Ray job ${file.externalId} for ${file.id} disappeared`);
				continue;
			}
			console.error(`Failed to poll Ray job ${file.externalId} for ${file.id}`, error);
			pending += 1;
			continue;
		}

		if (status.state === 'succeeded' && status.result) {
			try {
				const targetPath = resultPathForFile(file);
				await writeEditorContent(targetPath, rayResponseToEditorContent(status.result));
				await prisma.file.update({
					where: { id: file.id },
					data: {
						initialTranscriptionPath: targetPath,
						state: 'READY'
					}
				});
				await sendRayCompletionEmail(file.id, true);
				delete state.submitted[file.id];
				await saveState();
				console.log(`Completed ${file.id} from Ray job ${file.externalId}`);
			} catch (error) {
				console.error(`Failed to finalize ${file.id}`, error);
				await prisma.file.update({
					where: { id: file.id },
					data: { state: 'PROCESSING_ERROR' }
				});
				await sendRayCompletionEmail(file.id, false);
				delete state.submitted[file.id];
				await saveState();
			}
			continue;
		}

		if (status.state === 'failed' || status.state === 'cancelled') {
			await prisma.file.update({
				where: { id: file.id },
				data: { state: 'PROCESSING_ERROR' }
			});
			await sendRayCompletionEmail(file.id, false);
			delete state.submitted[file.id];
			await saveState();
			console.error(`Ray job ${file.externalId} for ${file.id} ended as ${status.state}`);
			continue;
		}

		const nowSeconds = Date.now() / 1000;
		const elapsed = Math.max(0, nowSeconds - status.created_at);
		const initialBudget =
			typeof status.expected_completion_at === 'number'
				? Math.max(0, status.expected_completion_at - status.created_at)
				: 30 * 60;
		const stallThreshold = Math.max(30 * 60, initialBudget * 3);
		if (elapsed > stallThreshold) {
			await prisma.file.update({
				where: { id: file.id },
				data: { state: 'PROCESSING_ERROR' }
			});
			await sendRayCompletionEmail(file.id, false);
			delete state.submitted[file.id];
			await saveState();
			console.error(
				`Ray job ${file.externalId} for ${file.id} stalled after ${Math.floor(elapsed / 60)} min`
			);
			continue;
		}

		pending += 1;
	}
	return pending;
};

const countQueued = async () =>
	prisma.file.count({
		where: {
			state: 'UPLOADED',
			OR: [{ language: 'estonian' }, { language: 'est' }]
		}
	});

const run = async () => {
	let iteration = 0;
	while (true) {
		iteration += 1;
		let queuedBefore = 0;
		if (submitUploaded) {
			queuedBefore = await submitQueuedFiles();
		}
		const pending = monitor ? await monitorRayFiles() : 0;
		const queuedAfter = await countQueued();
		console.log(
			`ray-backfill iteration=${iteration} queued_before=${queuedBefore} queued_after=${queuedAfter} pending_ray=${pending}`
		);

		if (once || (queuedAfter === 0 && pending === 0)) {
			break;
		}
		await sleep(pollIntervalMs);
	}
};

try {
	await run();
} finally {
	await prisma.$disconnect();
}
