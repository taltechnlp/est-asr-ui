export interface TranscriberResult {
	id: string;
	metadata: {
		version: number;
	};
	done: boolean;
	message: string;
	error?: {
		code: number;
		message: string;
	};
	result: EditorContent;
}

export type SectionType = 'non-speech' | 'speech';
export type Speakers = {
	[index: string]: { name?: string };
};
export type Word = {
	confidence: number;
	start: number;
	end: number;
	punctuation: string;
	word: string;
	word_with_punctuation: string;
	unnormalized_words?: {
		confidence: number;
		end: number;
		word_with_punctuation: string;
		punctuation: string;
		start: number;
		word: string;
	}[];
};
export type Turn = {
	start: number;
	end: number;
	speaker: string;
	transcript: string;
	unnormalized_transcript: string;
	words?: Word[];
};
export type EditorContent = {
	speakers?: Speakers;
	sections?: {
		start: number;
		end: number;
		type: SectionType;
		turns?: Turn[];
	}[];
};

export type FinAsrResult = FinAsrPending | FinAsrFinished | FinAsrInProgress;

export type FinAsrPending = {
	done: false;
	id: string;
	status: 'pending';
	processing_started: number;
	message: string;
	metadata: {
		version: string;
	};
	result?: {
		sections: [FinSection];
		speakers?: {
			[index: string]: { name?: string };
		};
	};
};

export type FinAsrInProgress = {
	done: false;
	id: string;
	message: 'In progress';
	metadata: {
		version: string;
	};
	result: {
		sections: [FinSection];
		speakers?: {
			[index: string]: { name?: string };
		};
	};
	segments: {
		duration: number;
		jobid: string;
	}[];
};

export enum FinErrorCode {
	transcribing_failed_error = 1,
	no_job_error = 40,
	internal_error = 41
}

export type FinErrorMessage =
	| 'decoding failed'
	| 'server error'
	| 'job id not found'
	| 'job has incompatible api request';

export type FinAsrFinished = {
	done: true;
	error?: {
		code: FinErrorCode;
		message: FinErrorMessage;
	};
	message?: FinErrorMessage | string;
	id: string;
	metadata: {
		version: string;
	};
	processing_finished: number;
	processing_started: number;
	result: {
		sections: FinSection[];
		speakers?: {
			[index: string]: { name?: string };
		};
	};
};

export type FinSection = {
	start: number;
	end: number;
	transcript: string;
	words: FinWord[];
};

export type FinWord = {
	start: number;
	end: number;
	word: string;
};

export type FinUploadResult = {
	file?: string;
	jobid?: string;
	error?: string;
};

export type EstUploadResult = {
	success: boolean;
	requestId?: string;
	msg?: string;
};

export type EstProgress = {
	done: boolean;
	requestId: string;
	progress?: number;
	jobStatus?: string;
	queued?: number;
	success?: boolean;
	errorCode?: number;
};

export type EstResult = {
	requestId: string;
	done: boolean;
	success?: boolean;
	errorCode?: number;
	result?: EditorContent;
};

interface IWeblog {
	runName: string;
	runId: string;
	event:
		| 'started'
		| 'process_submitted'
		| 'process_started'
		| 'process_completed'
		| 'error'
		| 'completed';
	utcTime: number;
	// trace is only provided for the following events: process_submitted, process_started, process_completed, error
	trace?: {
		task_id: number;
		process: string;
		name: string;
		time: string | null;
		submit: number | null;
		start: number | null;
		complete: number | null;
		duration: number | null;
		realtime: number | null;
		queue: string | null;
		tag: string | null;
		hash: string;
		exit: number | null;
		status: 'PENDING' | 'SUBMITTED' | 'RUNNING' | 'CACHED' | 'COMPLETED' | 'ERROR';
	};
	// metadata is only provided for the following events: started, completed
	metadata?: {
		parameters: Record<string, unknown>;
		workflow: {
			stats: {
				succeededCount: number;
				runningCount: number;
				pendingCount: number;
				failedCount: number;
				progressLength: number;
			};
		};
	};
}

export type { IWeblog };

// New ASR format types (from est-asr-pipeline)
export interface NewWord {
	word_with_punctuation: string;
	start: number;
	end: number;
	word: string;
	punctuation: string;
}

export interface NewTurn {
	speaker: string;
	start: number;
	end: number;
	transcript: string;
	words: NewWord[];
	unnormalized_transcript: string;
}

export interface NewSection {
	type: 'speech';
	start: number;
	end: number;
	turns?: NewTurn[];
}

export interface NewSpeaker {
	[speakerId: string]: Record<string, unknown>;
}

export interface BestHypothesis {
	speakers: NewSpeaker;
	sections: NewSection[];
}

export interface Alternative {
	rank: number;
	text: string;
	avg_logprob: number;
}

export interface Segment {
	start: number;
	end: number;
	alternatives: Alternative[];
}

export interface AlternativesData {
	language: string;
	segments: Segment[];
}

export interface AsrMetadata {
	n_best: number;
	has_word_alignments: boolean;
	basename: string;
}

export interface TranscriptionResult {
	best_hypothesis: BestHypothesis;
	alternatives: AlternativesData;
	metadata: AsrMetadata;
}
