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
        }
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
    punctuation: number;
    word: string;
    word_with_punctuation: string;
    unnormalized_words?: [
        {
            confidence: number;
            end: number;
            word_with_punctuation: string;
            punctuation: string;
            start: number;
            word: string;
        }
    ];
};
export type Turn = {
    start: number;
    end: number;
    speaker: string;
    transcript: string;
    unnormalized_transcript: string;
    words?: [Word];
};
export type EditorContent = {
    speakers: Speakers;
    sections: [
        {
            start: number;
            end: number;
            type: SectionType;
            turns?: [Turn];
        }
    ];
};

export type FinAsrResult = FinAsrPending | FinAsrSuccess;

export type FinAsrPending = {
    "processing_started?": number;
    "status": "pending";
}

export type FinAsrSuccess = {
    model: [FinModel];
    processing_finished: number;
    processing_started: number;
    segments?: [FinSegment];   
    status: "done"
}

export type FinSegment = {
    duration: number;
    jobid: string;
    processing_finished: number;
    processing_started: number;
    responses?: [FinSegmentPart];
    start: number;
    status: FinSegmentStatus;
    stop: number;
    time: string;
}

export type FinAsrStatus = 'done' | '';
export type FinSegmentStatus = 'done' | '';

export type FinSegmentPart = {
    confidence: number;
    transcript?: string;
    words?: [{
        start: string;
        end: string;
        word: string;
    }]
}

export type FinModel = {
    "acoustic_scale": number;
    "beam": number;
    "frame_subsampling_factor": number;
    "language_code": string;
    "lattice_beam": number;
    "max_active": number;
    "min_active": number;
    "n_decoders": number;
    "name": string;
    "path": string;
    "silence_weight": number;
}