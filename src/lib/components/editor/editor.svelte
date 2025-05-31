<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { Editor, getDebugJSON } from '@tiptap/core';
	import Document from '@tiptap/extension-document';
	import Text from '@tiptap/extension-text';
	import DropCursor from '@tiptap/extension-dropcursor';
	import GapCursor from '@tiptap/extension-gapcursor';
	import TextStyle from '@tiptap/extension-text-style';
    import Paragraph from '@tiptap/extension-paragraph';
	import History from '@tiptap/extension-history';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotateLeft';
	import rotateRigth from 'svelte-awesome/icons/rotateRight';
	import download from 'svelte-awesome/icons/download';
	import debounce from 'lodash/debounce';
	import { downloadHandler, handleSave } from '$lib/download';
	import { _ } from 'svelte-i18n';

	interface Props {
		data: string;
		fileId: string;
	}

	let { data, fileId }: Props = $props();
	let element: HTMLDivElement | undefined = $state();
	let editor: undefined | Editor = $state();
	let demo = true;
	let hasUnsavedChanges = $state(false);

	// Track current values explicitly
	let currentFileId = $state(fileId);
	let currentEditor = $state(editor);
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
			debouncedSave = debounce(() => handleSaveLocal(), 5000, {
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
		const result = await handleSave(editorToSave, fileIdToSave);
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
		debouncedSave = debounce(() => handleSaveLocal(), 5000, {
			leading: false,
			trailing: true
		});
	}

	// Save before navigation to prevent data loss
	beforeNavigate(async () => {
		console.log('beforeNavigate triggered', { hasUnsavedChanges, currentFileId, currentEditor: !!currentEditor, demo });
		
		// Always cancel any pending debounced saves to prevent race conditions
		debouncedSave.cancel();
		
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
			debouncedSave.flush();
			// Standard way to show "Are you sure you want to leave?" dialog
			event.preventDefault();
			return event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
		}
	}

	onMount(() => {
		// Add beforeunload listener for browser navigation/reload/close
		window.addEventListener('beforeunload', handleBeforeUnload);

		editor = new Editor({
			element: element,
			extensions: [
				Document,
				DropCursor,
				GapCursor,
				Text,
				TextStyle,
				History,
                Paragraph
				/* Word,
				WordColor,
				Speaker  */
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
			content: data,

			onTransaction: () => {
				// force re-render so `editor.isActive` works as expected
				// editor = editor;
				if (!demo && currentFileId) {
					console.log('Transaction detected for fileId:', currentFileId);
					hasUnsavedChanges = true;
					debouncedSave();
				}
				// console.log(editor.schema);
			}
		});
	});

	onDestroy(() => {
		// Remove beforeunload listener
		window.removeEventListener('beforeunload', handleBeforeUnload);
		// Cancel any pending debounced saves to prevent race conditions
		debouncedSave.cancel();
		if (editor) {
			editor.destroy();
		}
	});
</script>

<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20"></div>
<div class="grid w-full mt-4 mb-12 justify-center">
	<div class="editor">
		{#if editor}
			<div class="toolbar sticky top-0 z-10 pt-1 pb-1">
				<div>
					<span
						onclick={() => editor.chain().focus().undo().run()}
						class:disabled={!editor.can().undo()}
						style="color: rgba(0, 0, 0, 0.54);"
						class="ml-6 tooltip tooltip-bottom cursor-pointer"
						data-tip={$_('file.toolbarUndo')}
					>
						<Icon data={rotateLeft} scale={1.5} />
					</span>
					<span
						onclick={() => editor.chain().focus().redo().run()}
						class:disabled={!editor.can().redo()}
						style="color: rgba(0, 0, 0, 0.54);"
						class="ml-3 tooltip tooltip-bottom cursor-pointer"
						data-tip={$_('file.toolbarRedo')}
					>
						<Icon data={rotateRigth} scale={1.5} />
					</span>
				</div>
				<div class="flex">
					<button
						class="btn btn-link btn-sm"
						onclick={() => {
							downloadHandler(editor.getJSON(), '', '', true, false);
						}}
					>
						<Icon data={download} scale={1} />
						<span class="ml-2"> {$_('file.toolbarDownload')} </span>
					</button>
				</div>
			</div>
		{/if}
		<div bind:this={element} id="myEditor" class="max-w-5xl "></div>
	</div>
</div>

<style>
	.editor {
		box-shadow: rgb(0 0 0 / 9%) 0px 4px 4px 4px;
	}
	button.active {
		background: black;
		color: white;
	}
	.toolbar {
		display: flex;
		justify-content: space-between;
		background-color: #f5f5f5 !important;
		border-color: #f5f5f5 !important;
	}

	.toolbar > button {
		background-color: -internal-light-dark(rgb(239, 239, 239), rgb(59, 59, 59));
		margin: 0 0.5rem;
		padding: 1px 6px;
		border-width: 2px;
		border-style: outset;
		border-color: -internal-light-dark(rgb(118, 118, 118), rgb(133, 133, 133));
	}
</style>