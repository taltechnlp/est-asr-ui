/**
 * ProseMirror Speech Editor - Public API
 *
 * A reusable library for real-time speech editing with word-level approval
 */

export { default as SpeechEditor } from './SpeechEditor.svelte';
export { default as SubtitlePreview } from './SubtitlePreview.svelte';
export { default as Toolbar } from './Toolbar.svelte';

export type {
	Word,
	SubtitleSegment,
	ApprovalMode,
	StreamingTextEvent,
	EditorConfig,
	AutoConfirmConfig
} from './utils/types';

export { speechSchema } from './schema';
export { splitWordsIntoSegments, shouldBreakAtWord } from './utils/subtitleRules';
export { segmentToSRT, segmentsToSRT, wordsToSegment } from './utils/srtExport';
