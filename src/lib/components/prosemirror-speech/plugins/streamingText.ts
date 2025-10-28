/**
 * Streaming Text Plugin
 *
 * Inserts streaming ASR text at document end without disrupting user's cursor
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { v4 as uuidv4 } from 'uuid';
import type { StreamingTextEvent } from '../utils/types';

export interface StreamingTextState {
	buffer: string[];
	pendingText: string;
	currentTime: number;
}

export const streamingTextKey = new PluginKey<StreamingTextState>('streamingText');

/**
 * Insert streaming text as pending words
 * For streaming models: REPLACES pending content (full hypothesis)
 */
function insertStreamingText(
	tr: Transaction,
	state: EditorState,
	text: string,
	startTime?: number,
	endTime?: number,
	isFinal?: boolean
): Transaction {
	console.log('[STREAMING-PLUGIN] insertStreamingText called:', {
		text: text.substring(0, 50),
		startTime,
		endTime,
		isFinal,
		docSize: tr.doc.content.size
	});

	const schema = state.schema;
	const doc = tr.doc;

	// Find the last paragraph by traversing from the end
	let lastPara: any = null;
	let lastParaPos = 0;

	// Traverse all children to find the last paragraph
	doc.descendants((node, pos) => {
		if (node.type.name === 'paragraph') {
			lastPara = node;
			lastParaPos = pos;
		}
	});

	console.log('[STREAMING-PLUGIN] Found paragraph:', { lastParaPos, paraSize: lastPara?.content.size });

	// If no paragraph found, create one
	if (!lastPara) {
		console.log('[STREAMING] No paragraph found, creating one');
		const newPara = schema.nodes.paragraph.create();
		tr.insert(1, newPara); // Insert after doc node opening
		lastParaPos = 1;
		lastPara = newPara;
	}

	// CLEAR all pending (unapproved) content from the last paragraph
	// This is because streaming ASR sends FULL hypothesis, not incremental
	const paraStart = lastParaPos + 1; // +1 to skip paragraph node opening
	const paraEnd = lastParaPos + lastPara.nodeSize - 1; // -1 to skip paragraph node closing

	// Find range of pending content to delete
	let firstPendingPos: number | null = null;
	let lastPendingPos: number | null = null;

	doc.nodesBetween(paraStart, paraEnd, (node, pos) => {
		if (node.isText && node.marks.length > 0) {
			const wordMark = node.marks.find((mark) => mark.type.name === 'word');
			if (wordMark && !wordMark.attrs.approved) {
				if (firstPendingPos === null) {
					firstPendingPos = pos;
				}
				lastPendingPos = pos + node.nodeSize;
			}
		}
	});

	// Delete all pending content in one operation
	if (firstPendingPos !== null && lastPendingPos !== null) {
		tr.delete(firstPendingPos, lastPendingPos);

		// Re-find the last paragraph after deletion
		lastPara = null;
		lastParaPos = 0;
		tr.doc.descendants((node, pos) => {
			if (node.type.name === 'paragraph') {
				lastPara = node;
				lastParaPos = pos;
			}
		});
	}

	// Insert position is at the end of the last paragraph
	const insertPos = lastParaPos + 1 + (lastPara?.content.size || 0);

	console.log('[STREAMING-PLUGIN] Insert position:', insertPos);

	// Split text into words (preserve spacing)
	const words = text.split(/(\s+)/);

	console.log('[STREAMING-PLUGIN] Split into', words.length, 'parts');

	let currentPos = insertPos;
	let wordStartTime = startTime || 0;
	const totalDuration = (endTime || 0) - (startTime || 0);
	const timePerChar = words.join('').length > 0 ? totalDuration / words.join('').length : 0;

	let insertedWords = 0;
	let insertedSpaces = 0;

	for (const word of words) {
		if (word.length === 0) continue;

		// Calculate word timing (estimated if not provided)
		const wordEndTime = wordStartTime + word.length * timePerChar;

		// Only create word marks for non-whitespace text
		if (word.trim().length > 0) {
			// Create word mark
			const wordMark = schema.marks.word.create({
				id: uuidv4(),
				start: wordStartTime,
				end: wordEndTime,
				approved: false
			});

			// Create pending mark for visual styling
			const pendingMark = schema.marks.pending.create();

			// Create text node with marks
			const textNode = schema.text(word, [wordMark, pendingMark]);

			// Insert the text node
			tr.insert(currentPos, textNode);
			insertedWords++;
		} else {
			// Insert whitespace without marks
			const textNode = schema.text(word);
			tr.insert(currentPos, textNode);
			insertedSpaces++;
		}

		currentPos += word.length;
		wordStartTime = wordEndTime;
	}

	console.log('[STREAMING-PLUGIN] Inserted', insertedWords, 'words and', insertedSpaces, 'spaces');
	console.log('[STREAMING-PLUGIN] Final doc size:', tr.doc.content.size);

	// Mark transaction to not add to history
	tr.setMeta('addToHistory', false);

	// Only mark as streaming if this is NOT final text
	// This allows auto-confirm to start scheduling timers when final text arrives
	if (!isFinal) {
		tr.setMeta('streamingText', true);
		console.log('[STREAMING-PLUGIN] Marked as streaming (non-final)');
	} else {
		console.log('[STREAMING-PLUGIN] NOT marked as streaming (final text)');
	}

	return tr;
}

/**
 * Create streaming text plugin
 */
export function streamingTextPlugin() {
	return new Plugin<StreamingTextState>({
		key: streamingTextKey,

		state: {
			init(): StreamingTextState {
				return {
					buffer: [],
					pendingText: '',
					currentTime: 0
				};
			},

			apply(tr, value): StreamingTextState {
				// Handle streaming text meta
				const streamingEvent = tr.getMeta('insertStreamingText') as
					| StreamingTextEvent
					| undefined;

				if (streamingEvent) {
					const { text, isFinal } = streamingEvent;

					if (isFinal) {
						// Final text, clear buffer
						return {
							...value,
							buffer: [],
							pendingText: '',
							currentTime: streamingEvent.end || value.currentTime
						};
					} else {
						// Partial text, add to buffer
						return {
							...value,
							pendingText: text,
							currentTime: streamingEvent.end || value.currentTime
						};
					}
				}

				return value;
			}
		},

		// Handle incoming streaming text
		appendTransaction(transactions, oldState, newState) {
			const tr = newState.tr;
			let modified = false;

			for (const transaction of transactions) {
				const streamingEvent = transaction.getMeta('insertStreamingText') as
					| StreamingTextEvent
					| undefined;

				if (streamingEvent && streamingEvent.text) {
					insertStreamingText(
						tr,
						newState,
						streamingEvent.text,
						streamingEvent.start,
						streamingEvent.end,
						streamingEvent.isFinal
					);
					modified = true;
				}
			}

			return modified ? tr : null;
		}
	});
}

/**
 * Helper: Insert streaming text from external source
 */
export function insertStreamingTextCommand(
	state: EditorState,
	dispatch: (tr: Transaction) => void,
	event: StreamingTextEvent
): boolean {
	const tr = state.tr;
	tr.setMeta('insertStreamingText', event);
	dispatch(tr);
	return true;
}
