import { ASR_RAY_URL } from '$env/static/private';
import type { EditorContent, Speakers, SectionType, Turn, Word } from '$lib/helpers/api.d';

export type RayJobState = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RayWord {
	word_with_punctuation?: string;
	word?: string;
	punctuation?: string;
	start: number;
	end: number;
	ctc_conf?: number | null;
	entropy_conf?: number | null;
	probability?: number;
}

export interface RaySegment {
	start: number;
	end: number;
	text: string;
	speaker?: string | null;
	words?: RayWord[];
	[key: string]: unknown;
}

export interface RayTranscribeResponse {
	request_id: string;
	segments: RaySegment[];
	timings: Record<string, number>;
	warnings: { stage: string; error: string }[];
	config_used: Record<string, unknown>;
}

export interface RayErrorResponse {
	error: string;
	stage?: string;
	detail?: string;
	request_id?: string;
}

export interface RayJobStatus {
	job_id: string;
	state: RayJobState;
	progress: number | null;
	result: RayTranscribeResponse | null;
	error: RayErrorResponse | null;
	created_at: number;
	updated_at: number;
	eta_seconds: number | null;
}

export interface RayJobCreated {
	job_id: string;
	state: RayJobState;
	request_id?: string;
	eta_seconds?: number | null;
}

const rayUrl = (path: string) => `${ASR_RAY_URL.replace(/\/+$/, '')}${path}`;

const describeNetworkError = (err: unknown): string => {
	const cause = (err as { cause?: { code?: string; message?: string } } | null)?.cause;
	const code = cause?.code;
	if (code === 'ECONNREFUSED') return `unreachable at ${ASR_RAY_URL}`;
	if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return `timeout talking to ${ASR_RAY_URL}`;
	return cause?.message || (err instanceof Error ? err.message : String(err));
};

export const submitRayJob = async (
	inputAudioPath: string
): Promise<{ jobId: string } | null> => {
	try {
		const res = await fetch(rayUrl('/jobs'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				input_audio_path: inputAudioPath,
				diarization: true,
				forced_alignment: true,
				fa_method: 'xlsr',
				whisper_language: 'et'
			})
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error(`[RAY] /jobs returned ${res.status}: ${text}`);
			return null;
		}
		const body = (await res.json()) as RayJobCreated;
		if (!body.job_id) {
			console.error('[RAY] /jobs response missing job_id', body);
			return null;
		}
		return { jobId: body.job_id };
	} catch (err) {
		console.warn(`[RAY] submitRayJob: ${describeNetworkError(err)}`);
		return null;
	}
};

export const getRayJobStatus = async (
	jobId: string
): Promise<RayJobStatus | null> => {
	try {
		const res = await fetch(rayUrl(`/jobs/${encodeURIComponent(jobId)}`));
		if (!res.ok) {
			if (res.status !== 404) {
				console.error(`[RAY] /jobs/${jobId} returned ${res.status}`);
			}
			return null;
		}
		return (await res.json()) as RayJobStatus;
	} catch (err) {
		console.warn(`[RAY] getRayJobStatus: ${describeNetworkError(err)}`);
		return null;
	}
};

const stripTrailingPunct = (w: string): { word: string; punctuation: string } => {
	const stripped = w.replace(/[.,;:!?…""\u201c\u201d\u2019\u2018\-)]+$/u, '');
	const punctuation = w.slice(stripped.length);
	return { word: stripped || w, punctuation: stripped ? punctuation : '' };
};

const toConfidence = (rw: RayWord): number => {
	if (typeof rw.ctc_conf === 'number') return rw.ctc_conf;
	if (typeof rw.probability === 'number') return rw.probability;
	if (typeof rw.entropy_conf === 'number') return rw.entropy_conf;
	return 1;
};

const mapWord = (rw: RayWord): Word => {
	const raw = rw.word_with_punctuation ?? rw.word ?? '';
	const wordBase = rw.word ?? stripTrailingPunct(raw).word;
	const punctuation = rw.punctuation ?? stripTrailingPunct(raw).punctuation;
	return {
		confidence: toConfidence(rw),
		start: rw.start,
		end: rw.end,
		punctuation,
		word: wordBase,
		word_with_punctuation: raw || wordBase
	};
};

export const rayResponseToEditorContent = (
	resp: RayTranscribeResponse
): EditorContent => {
	const speakers: Speakers = {};
	const sections: NonNullable<EditorContent['sections']> = [];

	if (!resp.segments || resp.segments.length === 0) {
		return {
			speakers: { S1: { name: 'S1' } },
			sections: [{ start: 0, end: 0, type: 'non-speech' as SectionType }]
		};
	}

	for (const seg of resp.segments) {
		const speakerId = seg.speaker || 'SPEAKER_00';
		if (!speakers[speakerId]) {
			speakers[speakerId] = { name: speakerId };
		}
		const words: Word[] = (seg.words ?? []).map(mapWord);
		const turn: Turn = {
			start: seg.start,
			end: seg.end,
			speaker: speakerId,
			transcript: seg.text,
			unnormalized_transcript: seg.text,
			words: words.length > 0 ? words : undefined
		};
		sections.push({
			start: seg.start,
			end: seg.end,
			type: 'speech' as SectionType,
			turns: [turn]
		});
	}

	return { speakers, sections };
};
