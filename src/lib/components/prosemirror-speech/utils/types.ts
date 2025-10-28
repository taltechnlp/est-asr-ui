/**
 * Types for ProseMirror Speech Editor
 */

export type Word = {
	id: string;
	text: string;
	start: number; // timestamp in seconds
	end: number; // timestamp in seconds
	approved: boolean;
};

export type SubtitleSegment = {
	index: number;
	words: Word[];
	startTime: number;
	endTime: number;
	text: string;
	srt: string; // formatted SRT block
};

export type ApprovalMode = 'word' | 'sentence' | 'paragraph';

export type StreamingTextEvent = {
	text: string;
	isFinal: boolean;
	start?: number;
	end?: number;
};

export type AutoConfirmConfig = {
	enabled: boolean;
	timeoutSeconds: number; // 5-15 seconds
};

export type EditorConfig = {
	fontSize?: number;
	theme?: 'light' | 'dark';
	onSubtitleEmit?: (srt: string, segment: SubtitleSegment) => void;
	onWordApproved?: (word: Word) => void;
	autoConfirm?: AutoConfirmConfig;
};
