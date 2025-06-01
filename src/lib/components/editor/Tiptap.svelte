<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import type { Node, Schema } from 'prosemirror-model';
	import Document from '@tiptap/extension-document';
	import { LabelHighlight } from '../marks/labelHighlight';
	import { PronHighlight } from '../marks/pronHighlight';
	import { Editor, EditorContent, BubbleMenu, createEditor } from 'svelte-tiptap';
	import type { Readable } from 'svelte/store';
	import Text from '@tiptap/extension-text';
	import DropCursor from '@tiptap/extension-dropcursor';
	import GapCursor from '@tiptap/extension-gapcursor';
	import TextStyle from '@tiptap/extension-text-style';
	import History from '@tiptap/extension-history';
	import { Speaker } from '../nodes/speaker';
	import { Word } from '../marks/word';
	import { WordColor } from '../plugins/wordColor';
	import { Annotation } from '../plugins/annotation';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotateLeft';
	import rotateRigth from 'svelte-awesome/icons/rotateRight';
	import download from 'svelte-awesome/icons/download';
	import keyboard from 'svelte-awesome/icons/keyboardO';
	import settings from 'svelte-awesome/icons/cog';
	import pencil from 'svelte-awesome/icons/pencilSquareO';
	import LanguageLabel from './toolbar/LanguageLabel.svelte';
	import debounce from 'lodash/debounce';
	import {
		editorMounted,
		duration,
		editor as editorStore,
		editorMode,
		waveform, 
		fontSize as fontSizeStore,
		player
	} from '$lib/stores.svelte';
	import { Change, ChangeSet, Span, simplifyChanges } from 'prosemirror-changeset';
	import { _, locale } from 'svelte-i18n';
	import { transactionsHaveChange } from '$lib/components/editor/api/transaction';
	import LanguageSelection from './toolbar/LanguageSelection.svelte';
	import PronounceLabel from './toolbar/PronLabel.svelte';
	import Download from './toolbar/Download.svelte';
	import Hotkeys from './toolbar/Hotkeys.svelte';
	import Settings from './toolbar/Settings.svelte';
	import hotkeys from 'hotkeys-js';
	
	interface Props {
		content: any;
		fileName: any;
		fileId: any;
		uploadedAt: any;
		demo: any;
	}

	let {
		content,
		fileName,
		fileId,
		uploadedAt,
		demo
	}: Props = $props();

	let element: HTMLDivElement | undefined;
	let editor: Readable<Editor> = $state();

	// Track current values to prevent closure capture bug
	let currentFileId = $state(fileId);
	let currentEditor = $state(editor);
	let hasUnsavedChanges = $state(false);
	let debouncedSave: any = $state();

	// Watch for fileId changes and recreate debounced function
	$effect(() => {
		if (currentFileId !== fileId) {
			console.log('FileId changed from', currentFileId, 'to', fileId);
			// Cancel any pending saves for the old file
			if (debouncedSave) {
				debouncedSave.cancel();
				console.log('Cancelled debounced save for old fileId:', currentFileId);
			}
			hasUnsavedChanges = false;
			currentFileId = fileId;
			
			// Create a new debounced function for the new file
			debouncedSave = debounce(handleSaveLocal, 5000, {
				leading: false,
				trailing: true
			});
			console.log('Created new debounced save for fileId:', fileId);
		}
	});

	// Watch for editor changes
	$effect(() => {
		currentEditor = editor;
	});

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

	onMount(() => {
		// Add beforeunload listener for browser navigation/reload/close
		window.addEventListener('beforeunload', handleBeforeUnload);

		editor = createEditor({
			extensions: [
				Document,
				DropCursor,
				GapCursor,
				Text,
				TextStyle,
				History,
				Word,
				WordColor,
				Speaker,
				LabelHighlight.configure({
					HTMLAttributes: {
						class: 'lang-label',
						multicolor: true
					}
				}),
				PronHighlight.configure({
					HTMLAttributes: {
						multicolor: true
					}
				})
			],
			editorProps: {
				attributes: {
					class: 'editing-container focus:outline-none'
				}
				/* handleDOMEvents: { 
                      keydown: (view, event) => {
                        if (event.key === "Enter") {
                          editor.commands.setSpeaker()   
                          event.preventDefault()           
                        }
                        return false;
                      }
                    }, */
			},

			content: content,

			onTransaction: ({ editor, transaction }) => {
				// force re-render so `editor.isActive` works as expected
				// editor = editor;

				const speakerChanged = (node: Node) => node.type === schema.nodes.speaker;
				const speakerChanges = transactionsHaveChange(
					[transaction],
					prevEditorDoc,
					transaction.doc,
					speakerChanged
				);
				prevEditorDoc = transaction.doc;
				// console.log(speakerChanges)
				// console.log(transaction, editor.state)
				if (!demo && currentFileId) {
					console.log('Transaction detected for fileId:', currentFileId);
					hasUnsavedChanges = true;
					if (debouncedSave) {
						debouncedSave();
					}
				}
				// console.log(editor.schema);
			}
		});
		editorStore.set($editor);
		editorMounted.set(true);
		let prevEditorDoc: Node = $editor.state.doc;
		const schema = $editor.schema;
		

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
			$editor.setEditable(false, false);
			editable = $editor.isEditable;
		}
	});

	let windowWidth = $state(window.innerWidth);
	const updateWindowSize = () => windowWidth = window.innerWidth;
	window.addEventListener("resize", updateWindowSize);
	let editable = $state(true);


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
		window.removeEventListener("resize", updateWindowSize)
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
		const result = await fetch(`/api/files/${currentFileId}`, {
			method: 'PUT',
			body: JSON.stringify($currentEditor.getJSON())
		}).catch(e=> console.error("Saving file failed", currentFileId))
		if (!result || !result.ok) {
			return false;
		}
		return true;
	}

	let isActive = $derived((name, attrs = {}) => $editor.isActive(name, attrs));
	let fontSize: string = $state(localStorage.getItem('fontSize'));
	$effect(() => {
		fontSizeStore.set(fontSize)
	});
	if (!fontSize) fontSize = "16"; // 16px default
</script>

<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20"></div>
<div class="grid w-full mb-12 justify-center">
	<div class="stats stats-horizontal shadow mb-4">
		<div class="stat">
			<div class="stat-title">{fileName}</div>
			<div class="flex justify-between text-">
				<div class="w-1/2 stat-desc mr-3">{$_('file.duration')} {durationSeconds}</div>
				<div class="w-1/2 stat-desc">{$_('file.uploaded')} {uploadedAtFormatted}</div>
			</div>
		</div>

		<div class="stat">
			<fieldset>
				<legend class="stat-title">{$_('file.editingMode')}</legend>
				<div class="stat-desc flex flex-col">
					<label for="">
						<input type="radio" name="mode" value={1} bind:group={$editorMode} />
						{$_('file.editingModeRegular')}
					</label>
					<label for="">
						<input type="radio" name="mode" value={2} bind:group={$editorMode} />
						{$_('file.editingModeAnnotation')}
					</label>
				</div>
			</fieldset>
		</div>
	</div>
	<div class="editor max-w-5xl">
		{#if $editor}
			<div class="toolbar sticky top-0 z-10 pt-1 pb-1 bg-base-200">
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
				
				{#if $editorMode === 2}
					<LanguageLabel {editor} />
					<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
					<PronounceLabel {editor} />
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
		<EditorContent editor={$editor} />
	</div>
	{#if editor && $editorMode === 2}
		<BubbleMenu editor={$editor}>
			<div class="flex items-center my-bubble-menu bg-base-200 shadow-md">
				<LanguageLabel {editor} />
				<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2"></div>
				<PronounceLabel {editor} />
			</div>
		</BubbleMenu>
	{/if}
	<LanguageSelection 
		onSetActive={(label) => {/* handle language activation */}} 
		onSave={(options) => {/* handle save language options */}} 
	/>
	<Hotkeys />
	<Settings bind:fontSize={fontSize}></Settings>
	<Download fileName={fileName} />
</div>

<style>
	.disabled {
		color: rgba(0, 0, 0, 0.54) !important;
	}
	.editor {
		box-shadow: rgb(0 0 0 / 9%) 0px 4px 4px 4px;
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

</style>
