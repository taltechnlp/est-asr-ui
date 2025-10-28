/**
 * Auto-Confirm Plugin
 *
 * Automatically approves words after a configurable timeout if not manually approved
 * Each word is tracked individually and confirmed in real-time
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { AutoConfirmConfig } from '../utils/types';
import { approveWordAtPosition } from './wordApproval';

export interface AutoConfirmState {
	config: AutoConfirmConfig;
	pendingWords: Map<string, { wordId: string; timeout: NodeJS.Timeout }>;
	isStreamingActive: boolean;
}

export const autoConfirmKey = new PluginKey<AutoConfirmState>('autoConfirm');

/**
 * Create auto-confirm plugin
 */
export function autoConfirmPlugin(initialConfig: AutoConfirmConfig = { enabled: true, timeoutSeconds: 5 }) {
	return new Plugin<AutoConfirmState>({
		key: autoConfirmKey,

		state: {
			init(): AutoConfirmState {
				return {
					config: initialConfig,
					pendingWords: new Map(),
					isStreamingActive: false
				};
			},

			apply(tr, value, oldState, newState): AutoConfirmState {
				let { config, pendingWords, isStreamingActive } = value;

				// Update config if changed
				const newConfig = tr.getMeta('updateAutoConfirm');
				if (newConfig) {
					config = newConfig;

					// Clear all existing timers if disabled
					if (!config.enabled) {
						pendingWords.forEach((pending) => clearTimeout(pending.timeout));
						pendingWords.clear();
					}
				}

				// Track streaming state
				const isStreamingText = tr.getMeta('streamingText');
				const streamingEnded = tr.getMeta('streamingEnded');

				if (isStreamingText) {
					isStreamingActive = true;
					// Don't clear timers - let each word's timer fire individually
					// Old timers for replaced words will gracefully fail when word not found
				} else if (streamingEnded) {
					// Recording stopped, clear streaming flag
					console.log('[AUTO-CONFIRM] Streaming ended');
					isStreamingActive = false;
				} else if (tr.docChanged) {
					// Non-streaming doc change means final text arrived
					isStreamingActive = false;
				}

				// Clean up approved words and non-existent words from pending timers
				if (tr.docChanged) {
					const approvedWords = new Set<string>();
					const existingWords = new Set<string>();

					newState.doc.descendants((node) => {
						if (node.isText && node.marks.length > 0) {
							const wordMark = node.marks.find((mark) => mark.type.name === 'word');
							if (wordMark) {
								existingWords.add(wordMark.attrs.id);
								if (wordMark.attrs.approved) {
									approvedWords.add(wordMark.attrs.id);
								}
							}
						}
					});

					// Clear timers for approved words or words that no longer exist
					pendingWords.forEach((pending, wordId) => {
						if (approvedWords.has(wordId) || !existingWords.has(wordId)) {
							clearTimeout(pending.timeout);
							pendingWords.delete(wordId);
						}
					});
				}

				return {
					config,
					pendingWords,
					isStreamingActive
				};
			}
		},

		view(editorView: EditorView) {
			let lastDocSize = editorView.state.doc.content.size;

			return {
				update(view, prevState) {
					const pluginState = autoConfirmKey.getState(view.state);
					if (!pluginState || !pluginState.config.enabled) {
						return;
					}

					// Schedule timers for new pending words whenever doc changes
					// This includes during streaming for real-time auto-confirm
					const currentDocSize = view.state.doc.content.size;
					const docModified = view.state.doc !== prevState.doc;

					if (docModified) {
						console.log('[AUTO-CONFIRM] Doc changed, scheduling timers for new words');

						// Find new pending words and schedule auto-confirm
						view.state.doc.descendants((node, pos) => {
							if (node.isText && node.marks.length > 0) {
								const wordMark = node.marks.find((mark) => mark.type.name === 'word');
								const pendingMark = node.marks.find((mark) => mark.type.name === 'pending');

								// If word is pending and not already scheduled
								if (wordMark && pendingMark && !wordMark.attrs.approved) {
									const wordId = wordMark.attrs.id;

									if (!pluginState.pendingWords.has(wordId)) {
										// Schedule auto-confirm
										console.log('[AUTO-CONFIRM] Scheduling timer for word:', wordId, 'text:', node.text);
										const timeout = setTimeout(() => {
											// Auto-approve this word
											const currentState = view.state;
											const currentPluginState = autoConfirmKey.getState(currentState);

											if (currentPluginState) {
												// Check if word still exists
												let wordPos: number | null = null;
												let wordStillExists = false;

												currentState.doc.descendants((n, p) => {
													if (n.isText && n.marks.find((m) => m.type.name === 'word' && m.attrs.id === wordId)) {
														wordPos = p;
														wordStillExists = true;
														return false;
													}
												});

												if (wordStillExists && wordPos !== null) {
													console.log('[AUTO-CONFIRM] Timer fired, approving word:', wordId);
													approveWordAtPosition(currentState, view.dispatch, wordPos);

													// Check if this was the last pending word - if so, trigger final segment emission
													setTimeout(() => {
														const latestState = view.state;
														let hasPendingWords = false;
														latestState.doc.descendants((n) => {
															if (n.isText && n.marks.length > 0) {
																const wMark = n.marks.find((m) => m.type.name === 'word');
																const pMark = n.marks.find((m) => m.type.name === 'pending');
																if (wMark && pMark && !wMark.attrs.approved) {
																	hasPendingWords = true;
																	return false;
																}
															}
														});

														if (!hasPendingWords) {
															console.log('[AUTO-CONFIRM] All words approved, triggering final segment check');
															const tr = latestState.tr;
															tr.setMeta('allWordsApproved', true);
															view.dispatch(tr);
														}
													}, 100);
												} else {
													console.log('[AUTO-CONFIRM] Timer fired but word no longer exists:', wordId);
												}
												// Clean up from pending words
												currentPluginState.pendingWords.delete(wordId);
											}
										}, pluginState.config.timeoutSeconds * 1000);

										pluginState.pendingWords.set(wordId, { wordId, timeout });
									}
								}
							}
						});
					}

					lastDocSize = currentDocSize;
				},

				destroy() {
					// Clean up all timers
					const pluginState = autoConfirmKey.getState(editorView.state);
					if (pluginState) {
						pluginState.pendingWords.forEach((pending) => clearTimeout(pending.timeout));
						pluginState.pendingWords.clear();
					}
				}
			};
		}
	});
}

/**
 * Helper: Update auto-confirm config
 */
export function updateAutoConfirmConfig(
	state: EditorState,
	dispatch: (tr: Transaction) => void,
	config: AutoConfirmConfig
): boolean {
	const tr = state.tr;
	tr.setMeta('updateAutoConfirm', config);
	dispatch(tr);
	return true;
}
