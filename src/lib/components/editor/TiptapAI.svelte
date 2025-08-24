<script lang="ts">
	import { run } from 'svelte/legacy';

	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { getDebugJSON } from '@tiptap/core';
	import type { Node, Schema } from 'prosemirror-model';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import History from '@tiptap/extension-history';
import { Editor, EditorContent, createEditor } from 'svelte-tiptap';
import type { Readable } from 'svelte/store';
import { TextStyle } from '@tiptap/extension-text-style';
	import { Speaker } from '../nodes/speaker';
	import { Diff } from '../nodes/diff';
	import { WordNode } from '../nodes/word-ai';  // Use Word nodes instead of marks
	import { WordColorAI } from '../plugins/wordColorAI';  // AI-specific word color plugin
	import { Annotation } from '../plugins/annotation';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotateLeft';
	import rotateRigth from 'svelte-awesome/icons/rotateRight';
	import download from 'svelte-awesome/icons/download';
	import keyboard from 'svelte-awesome/icons/keyboardO';
	import settings from 'svelte-awesome/icons/cog';
	import pencil from 'svelte-awesome/icons/pencilSquareO';
	import debounce from 'lodash/debounce';
	import {
		editorMounted,
		duration,
		editor as editorStore,
		waveform, 
		fontSize as fontSizeStore,
		player
	} from '$lib/stores.svelte';
	import { Change, ChangeSet, Span, simplifyChanges } from 'prosemirror-changeset';
	import { _, locale } from 'svelte-i18n';
	import { transactionsHaveChange } from '$lib/components/editor/api/transaction';
	import LanguageSelection from './toolbar/LanguageSelection.svelte';
	import Download from './toolbar/Download.svelte';
	import Hotkeys from './toolbar/Hotkeys.svelte';
	import Settings from './toolbar/Settings.svelte';
	import hotkeys from 'hotkeys-js';
	import SummaryAccordion from '../transcript-summary/SummaryAccordion.svelte';
	import type { TranscriptSummary } from '@prisma/client';
	import { getCoordinatingAgentClientAI } from '$lib/agents/coordinatingAgentClientAI';
	import { getCoordinatingAgentPositionClient } from '$lib/agents/coordinatingAgentPositionClient';
	

	interface Props {
		initialContent?: any;
		fileName: any;
		fileId: any;
		uploadedAt: any;
		demo: any;
		summary?: TranscriptSummary | null;
		onSummaryGenerated?: (summary: TranscriptSummary) => void;
		transcriptReady?: boolean;
	}

	let {
		initialContent,
		fileName,
		fileId,
		uploadedAt,
		demo,
		summary = null,
		onSummaryGenerated = () => {},
		transcriptReady = false
	}: Props = $props();

	let element: HTMLDivElement | undefined;
	let editor: Readable<Editor> = $state();

	// Track current values to prevent closure capture bug
	let currentFileId: string = typeof fileId === 'string' ? fileId : String(fileId ?? '');
	let currentEditor: Editor | null = null;
	let hasUnsavedChanges = $state(false);
	let debouncedSave: any = null;

	// Watch for fileId changes and recreate debounced function (avoid proxy identity issues)
	$effect(() => {
		const nextId = typeof fileId === 'string' ? fileId : String(fileId ?? '');
		if (currentFileId === nextId) return;
		console.log('FileId changed from', currentFileId, 'to', nextId);
		if (debouncedSave) {
			debouncedSave.cancel();
			console.log('Cancelled debounced save for old fileId:', currentFileId);
		}
		hasUnsavedChanges = false;
		currentFileId = nextId;
		debouncedSave = debounce(handleSaveLocal, 5000, {
			leading: false,
			trailing: true
		});
		console.log('Created new debounced save for fileId:', nextId);
	});

	// currentEditor will be updated manually in onMount when editor is created

	const options: Intl.DateTimeFormatOptions = {
		/* weekday: "long", */ year: '2-digit',
		month: 'long',
		day: 'numeric'
	};
	let uploadedAtFormatted = $derived(new Date(uploadedAt).toLocaleDateString($locale, options));
	let durationSeconds = $derived(new Date(1000 * $duration).toISOString().substr(11, 8));

	const date = new Date(0);
	date.setSeconds(45); // specify value for SECONDS here
	var timeString = date.toISOString().substring(11, 19);

	onMount(async () => {
		// Guard against SSR
		if (typeof window === 'undefined') {
			return;
		}
		
		// Add beforeunload listener for browser navigation/reload/close
		window.addEventListener('beforeunload', handleBeforeUnload);

		// Declare variables that will be used in the editor creation
		let prevEditorDoc: Node;
		let schema: Schema;
		
		console.log('Creating TipTap editor with initialContent:', initialContent);
		
		try {
			const safeClone = (value: any) => {
				try { return JSON.parse(JSON.stringify(value)); } catch { return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }; }
			};
			const initial = safeClone(initialContent);
			const editorStoreLocal = createEditor({
				element,
				extensions: [
					Document,
					Paragraph,
					Dropcursor,
					Gapcursor,
					Text,
					TextStyle,
					History,
					WordNode,
					WordColorAI,
					Speaker,
					Diff,
				],
				editorProps: {
					attributes: {
						class: 'editing-container focus:outline-none ai-editor'  // Add ai-editor class
					}
				},

				content: initial,

				onTransaction: ({ editor, transaction }) => {
					// Initialize schema on first transaction if not already set
					if (!schema) {
						schema = editor.schema;
					}
					
					// Initialize prevEditorDoc on first transaction if not already set
					if (!prevEditorDoc) {
						prevEditorDoc = editor.state.doc;
					}
					
					const speakerChanged = (node: Node) => node.type === schema.nodes.speaker;
					const speakerChanges = transactionsHaveChange(
						[transaction],
						prevEditorDoc,
						transaction.doc,
						speakerChanged
					);
					prevEditorDoc = transaction.doc;
					
					// Ignore transactions until transcript has loaded and we are not hydrating
					if (!demo && currentFileId && transcriptReady && !hydrating) {
						console.log('Transaction detected for fileId:', currentFileId);
						hasUnsavedChanges = true;
						if (debouncedSave) {
							debouncedSave();
						}
					}
				}
			});
			
			console.log('Editor store created successfully:', !!editorStoreLocal);
			console.log('Editor store type:', typeof editorStoreLocal);
			console.log('Editor store properties:', Object.keys(editorStoreLocal));
			
			// Verify editor store was created successfully
			if (!editorStoreLocal) {
				console.error('Failed to create editor store');
				return;
			}
			
			// Get the actual editor instance from the store
			let actualEditor: Editor | null = null;
			const unsubscribe = editorStoreLocal.subscribe((editorInstance: Editor | null) => {
				actualEditor = editorInstance;
				console.log('Editor instance from store:', !!editorInstance, editorInstance?.state ? 'has state' : 'no state');
			});
			
			// Wait a bit for the editor to initialize if needed
			if (!actualEditor) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			
			if (!actualEditor || !actualEditor.state) {
				console.error('Failed to get actual editor instance from store');
				unsubscribe();
				return;
			}
			
			console.log('Actual editor retrieved successfully with state');
			try {
				console.log('[snapshot] editor.getJSON()', actualEditor.getJSON());
				console.log('[snapshot] editor.getText().length', actualEditor.getText()?.length || 0);
			} catch (e) { console.warn('snapshot failed', e); }
			
			// Set editor after creation to avoid reactivity loops
			editor = editorStoreLocal; // This is the store, not the editor instance
			currentEditor = actualEditor; // This is the actual editor instance
			editorStore.set(actualEditor); // Set the actual editor in the global store
			editorMounted.set(true);
			
			// Initialize schema and prevEditorDoc now that editor is created
			schema = actualEditor.schema;
			prevEditorDoc = actualEditor.state.doc;
			
			// Clean up subscription
			unsubscribe();

			// Set the editor in the coordinating agents for transaction support
			try {
				const agent = getCoordinatingAgentClientAI();
					agent.setEditor(actualEditor);
				
				// Also set for position-based agent
				const positionAgent = getCoordinatingAgentPositionClient();
					positionAgent.setEditor(actualEditor);
				
				// Listen for apply suggestion events from the sidebar
				const handleApplySuggestion = async (event: CustomEvent) => {
					const { suggestion, segmentId, callback } = event.detail;
					try {
						const result = await agent.applySuggestionManually(suggestion, segmentId);
						if (callback) callback(result);
					} catch (error) {
						if (callback) callback({ success: false, error: error.message });
					}
				};
				
				// Listen for apply suggestion as diff events from the sidebar
				const handleApplySuggestionAsDiff = async (event: CustomEvent) => {
					const { suggestion, segmentId, callback, segmentFrom, segmentTo } = event.detail as any;
					try {
						// Import the AI-specific diff creation functions
						const { findAndCreateDiff, findAndCreateDiffFuzzy, createDiffAtPosition } = await import('$lib/services/transcriptTextReplaceDiffAI');
						
						let result;
						
						// Check if we have reconciled positions
						if (suggestion.from !== undefined && suggestion.to !== undefined) {
							console.log(`Using reconciled positions [${suggestion.from}, ${suggestion.to}] for diff creation`);
							
							// Use position-based creation for reconciled positions
							result = createDiffAtPosition(
								actualEditor,
								suggestion.from,
								suggestion.to,
								suggestion.originalText,
								suggestion.suggestedText,
								{
									changeType: suggestion.type || 'text_replacement',
									confidence: suggestion.confidence || 0.5,
									context: suggestion.explanation || suggestion.text || '',
									validateText: true
								}
							);
						} else {
							console.log('No positions available, using text search for diff creation');
							
							// 1) Try existing exact/normalized search first
							result = findAndCreateDiff(
								actualEditor,
								suggestion.originalText,
								suggestion.suggestedText,
								{
									caseSensitive: false,
									changeType: suggestion.type || 'text_replacement',
									confidence: suggestion.confidence || 0.5,
									context: suggestion.explanation || suggestion.text || ''
								}
							);

							// 2) If that fails, try WordNode-aware fuzzy search scoped to the segment if we know it
							if (!result?.success) {
								const segmentBounds = (typeof segmentFrom === 'number' && typeof segmentTo === 'number' && segmentTo > segmentFrom)
									? { from: segmentFrom, to: segmentTo }
									: undefined;
								result = findAndCreateDiffFuzzy(
									actualEditor,
									suggestion.originalText,
									suggestion.suggestedText,
									{
										caseSensitive: false,
										changeType: suggestion.type || 'text_replacement',
										confidence: suggestion.confidence || 0.5,
										context: (suggestion.explanation || suggestion.text || '') + ' (fuzzy)',
										segmentBounds,
										segmentId,
										thresholds: { tokenSimilarity: 0.6, avgSimilarity: 0.75 },
									}
								);
							}
						}
						
						if (callback) callback(result);
					} catch (error) {
						console.error('Error creating diff:', error);
						if (callback) callback({ 
							success: false, 
							error: error instanceof Error ? error.message : 'Unknown error' 
						});
					}
				};
				
				window.addEventListener('applyTranscriptSuggestion', handleApplySuggestion as EventListener);
				window.addEventListener('applyTranscriptSuggestionAsDiff', handleApplySuggestionAsDiff as EventListener);
				
				// Cleanup listener on component destroy
				onDestroy(() => {
					window.removeEventListener('applyTranscriptSuggestion', handleApplySuggestion as EventListener);
					window.removeEventListener('applyTranscriptSuggestionAsDiff', handleApplySuggestionAsDiff as EventListener);
				});
			} catch (error) {
				console.warn('Failed to set editor in coordinating agent:', error);
			}
			
			hotkeys('tab', function(event, handler){
				event.preventDefault()
				if ($waveform) {
					// console.log($waveform)
					if ($player && $player.playing) $waveform.player.pause();
					else if ($player && !$player.playing) $waveform.player.play();
				}
			});
			hotkeys('shift+tab', function(event, handler){
				event.preventDefault()
				if ($waveform) {
					$waveform.player.seek($waveform.player.getCurrentTime() - 1)
				}
			});
			hotkeys('alt+tab', function(event, handler){
				event.preventDefault()
				if ($waveform) {
					$waveform.player.seek($waveform.player.getCurrentTime() + 1)
				}
			});
			if (windowWidth <= 460) {
				actualEditor.setEditable(false, false);
				editable = actualEditor.isEditable;
			}
			
		} catch (error) {
			console.error('Failed to create TipTap editor:', error);
			return;
		}
	});

	let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
	const updateWindowSize = () => {
		if (typeof window !== 'undefined') {
			windowWidth = window.innerWidth;
		}
	};
	if (typeof window !== 'undefined') {
		window.addEventListener("resize", updateWindowSize);
	}
	let editable = $state(true);
	let hydrating = $state(false);


	onDestroy(() => {
		// Remove beforeunload listener
		window.removeEventListener('beforeunload', handleBeforeUnload);
		// Cancel any pending debounced saves to prevent race conditions
		if (debouncedSave) {
			debouncedSave.cancel();
		}
		hotkeys.unbind();
		editorMounted.set(false);
		editorStore.set(null);
		if ($editor) {
			$editor.destroy();
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener("resize", updateWindowSize);
		}
	});

	// Allow parent to set content after mount
	export function setContent(next: any) {
		if ($editor && next) {
			// Suppress save while hydrating content programmatically
			hydrating = true;
			$editor.commands.setContent(next, false);
			setTimeout(() => { hydrating = false; }, 0);
		}
	}

	// If "initialContent" prop changes after mount, update editor safely (avoid proxy equality + loops)
	let lastInitialContentStr: string | null = null;
	$effect(() => {
		if (!$editor || !initialContent) return;
		const safeClone = (value: any) => { try { return JSON.parse(JSON.stringify(value)); } catch { return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }; } };
		const plain = safeClone(initialContent);
		const nextStr = JSON.stringify(plain);
		if (lastInitialContentStr === nextStr) return;
		queueMicrotask(() => {
			hydrating = true;
			$editor.commands.setContent(plain, false);
			lastInitialContentStr = nextStr;
			setTimeout(() => { hydrating = false; }, 0);
		});
	});

	async function handleSaveLocal() {
		// Capture values at function call time
		const editorToSave = currentEditor;
		const fileIdToSave = currentFileId;
		
		if (!editorToSave || !fileIdToSave) {
			console.warn('Cannot save: missing editor or fileId', { editor: !!editorToSave, fileId: fileIdToSave });
			return false;
		}

		// Double-check we're still on the same file
		if (fileIdToSave !== fileId) {
			console.warn('File changed during save, aborting save for:', fileIdToSave, 'current:', fileId);
			return false;
		}

		console.log('Attempting to save fileId:', fileIdToSave);
		const result = await handleSave();
		if (result) {
			hasUnsavedChanges = false;
			console.log('Successfully saved fileId:', fileIdToSave);
		} else {
			console.error('Failed to save fileId:', fileIdToSave);
		}
		return result;
	}

	// Initialize the debounced function
	if (!debouncedSave) {
		debouncedSave = debounce(handleSaveLocal, 5000, {
			leading: false,
			trailing: true
		});
	}

	// Save before navigation to prevent data loss
	beforeNavigate(async () => {
		console.log('beforeNavigate triggered', { hasUnsavedChanges, currentFileId, currentEditor: !!currentEditor, demo });
		
		// Always cancel any pending debounced saves to prevent race conditions
		if (debouncedSave) {
			debouncedSave.cancel();
		}
		
		// If there are unsaved changes, save them immediately
		if (hasUnsavedChanges && currentEditor && !demo && currentFileId) {
			console.log('Saving before navigation for fileId:', currentFileId);
			await handleSaveLocal(); // Execute immediately
		}
	});

	// Handle browser navigation/reload/close
	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (hasUnsavedChanges && !demo) {
			// Flush any pending debounced saves immediately
			if (debouncedSave) {
				debouncedSave.flush();
			}
			// Standard way to show "Are you sure you want to leave?" dialog
			event.preventDefault();
			return event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
		}
	}

	async function handleSave() {
		if (!currentEditor) return false;
		const payload = JSON.stringify(currentEditor.getJSON());
		const result = await fetch(`/api/files/${currentFileId}`, {
			method: 'PUT',
			body: payload
		}).catch(e=> console.error("Saving file failed", currentFileId))
		if (!result || !result.ok) {
			return false;
		}
		return true;
	}

	let isActive = $derived((name, attrs = {}) => $editor.isActive(name, attrs));
	let fontSize: string = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('fontSize') : null);
	run(() => {
		fontSizeStore.set(fontSize)
	});
	if (!fontSize) fontSize = "16"; // 16px default
</script>

<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20">
	<div class="badge badge-accent">AI Editor (Beta) - Word Nodes</div>
</div>
<div class="grid w-full mb-12 justify-center">
	<div class="max-w-5xl w-full">
		<div class="stats stats-horizontal shadow mb-4 w-full">
			<div class="stat">
				<div class="stat-title">{fileName}</div>
				<div class="flex justify-between text-">
					<div class="w-1/2 stat-desc mr-3">{$_('file.duration')} {durationSeconds}</div>
					<div class="w-1/2 stat-desc">{$_('file.uploaded')} {uploadedAtFormatted}</div>
				</div>
			</div>

		</div>
		
		{#if !demo}
			<div class="mb-4">
				<SummaryAccordion
					{fileId}
					onSummaryGenerated={onSummaryGenerated}
				/>
			</div>
		{/if}
	</div>
	
	<div class="editor max-w-5xl w-full">
		{#if $editor}
			<div class="toolbar sticky top-0 z-10 pt-1 pb-1 bg-white border-b border-gray-200">
				{#if !editable}
				<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('editor.editing.edit')}>
					<button
						onclick={() => {$editor.setEditable(true, true); editable = true;}}
						style="color: rgb(48, 49, 51);"
						class="ml-6 cursor-pointer btn btn-ghost flex"
					>
						<Icon data={pencil} scale={1.5} />
					</button>
					
				</div>				
				<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
				{:else if windowWidth <= 460}
				<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('editor.editing.save')}>
					<button onclick={() => {$editor.setEditable(false, true); editable = false;}}
						style="color: rgb(48, 49, 51);"
							class="ml-6 cursor-pointer btn btn-ghost flex"
						>{$_('editor.editing.save')}</button>
				</div>				
				<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
				{/if}
				<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('editor.settings.tooltip')}>
					<label for="settings-modal" class="btn btn-ghost flex  ">
						<Icon data={settings} scale={1.5} />
					</label>
				</div>
				<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
				{#if windowWidth > 460}
					<div class="flex items-center tooltip tooltip-bottom" data-tip={$_('editor.hotkeys.tooltip')}>
						<label for="hotkeys-modal" class="btn btn-ghost flex">
							<Icon data={keyboard} scale={1.5} />
						</label>
					</div>				
					<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
					<div class="flex items-center">
						<button
							onclick={() => $editor.chain().focus().undo().run()}
							class:disabled={!$editor.can().undo()}
							style="color: rgb(48, 49, 51);"
							class="ml-6 tooltip tooltip-bottom cursor-pointer"
							data-tip={$_('file.toolbarUndo')}
						>
							<Icon data={rotateLeft} scale={1.5} />
					</button>
					<button
							onclick={() => $editor.chain().focus().redo().run()}
							class:disabled={!$editor.can().redo()}
							style="color: rgb(48, 49, 51);"
							class="ml-3 tooltip tooltip-bottom cursor-pointer"
							data-tip={$_('file.toolbarRedo')}
						>
							<Icon data={rotateRigth} scale={1.5} />
					</button>
					</div>
					<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
				{/if}
				
				<div class="flex items-center">
					<label for="download-modal" class="btn btn-link btn-sm flex">
						<Icon data={download} scale={1} />
						<span class="ml-1 leading-3 hidden sm:block"> {$_('file.toolbarDownload')} </span>
					</label>
				</div>
				
			</div>
		{/if}
		<div class="editor-shell w-full min-h-[48vh] relative">
			<div class="editor-content-wrapper">
				<!-- Hidden mount element to satisfy svelte-tiptap NodeView renderers that expect an element -->
				<div bind:this={element} class="tiptap-mount" aria-hidden="true" style="position:absolute; left:-10000px; width:1px; height:1px; overflow:hidden;"></div>
				{#if $editor}
					<EditorContent editor={$editor} />
				{/if}
				{#if !transcriptReady}
					<div class="editor-loader absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-[1px]">
						<div class="loader h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
						<p class="text-sm text-gray-500">Loading transcript…</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
	<LanguageSelection />
	<Hotkeys />
	<Settings bind:fontSize={fontSize}></Settings>
	<Download fileName={fileName} />
</div>

<style>
	.disabled {
		color: rgba(0, 0, 0, 0.54) !important;
	}
	.editor {
		box-shadow: rgba(0, 0, 0, 0.02) 0px 1px 2px 0px, rgba(0, 0, 0, 0.04) 0px 1px 3px 1px;
		background: white;
	}

	.toolbar {
		display: flex;
		justify-content: space-around;
	}

	.my-bubble-menu {
		display: flex;
		justify-content: space-around;
		min-width: max-content;
		padding: 5px 5px;
		border-radius: var(--rounded-box, 0.5rem);
	}

	.editor-content-wrapper {
		position: relative;
		width: 100%;
		min-height: 48vh;
	}
	
	/* AI Editor specific styles */
	:global(.ai-editor .word-node) {
		display: inline !important;
		padding: 0 1px;
		cursor: pointer;
		white-space: nowrap;
	}
	
	:global(.ai-editor .word-node:hover) {
		background-color: rgba(112, 172, 199, 0.1);
		border-radius: 2px;
	}
	
	/* Ensure Word nodes stay inline */
	:global(.ai-editor span[data-word-node]) {
		display: inline !important;
	}
	
	/* No extra space needed - we have text nodes for that */

</style>