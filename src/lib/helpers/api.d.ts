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