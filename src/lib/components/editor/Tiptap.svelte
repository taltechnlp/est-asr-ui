<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getDebugJSON } from '@tiptap/core';
	import type { Node, Schema } from 'prosemirror-model';
	import Document from '@tiptap/extension-document';
	import { LabelHighlight } from '../marks/labelHighlight';
	import { PronHighlight } from '../marks/pronHighlight';
	// import Paragraph from '@tiptap/extension-paragraph';
	// import Heading from '@tiptap/extension-heading';
	import { Editor, EditorContent, FloatingMenu, BubbleMenu, createEditor } from 'svelte-tiptap';
	import type { Readable } from 'svelte/store';
	import Text from '@tiptap/extension-text';
	import DropCursor from '@tiptap/extension-dropcursor';
	import GapCursor from '@tiptap/extension-gapcursor';
	import TextStyle from '@tiptap/extension-text-style';

	/* import StarterKit from '@tiptap/starter-kit'; */
	// import type {Readable} from 'svelte/store'
	import History from '@tiptap/extension-history';
	import { Speaker } from '../nodes/speaker';
	import { Word } from '../marks/word';
	import { WordColor } from '../plugins/wordColor';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotate-left';
	import rotateRigth from 'svelte-awesome/icons/rotate-right';
	import download from 'svelte-awesome/icons/download';
	import thumbTack from 'svelte-awesome/icons/thumb-tack';
	import bookmarkO from 'svelte-awesome/icons/bookmark-o';
	import info from 'svelte-awesome/icons/info';
	import fileWordO from 'svelte-awesome/icons/file-word-o';
	import fileCodeO from 'svelte-awesome/icons/file-code-o';
	import stickyNoteO from 'svelte-awesome/icons/sticky-note-o';
	import ellipsisH from 'svelte-awesome/icons/ellipsis-h';

	import LanguageLabel from './toolbar/LanguageLabel.svelte';

	import language from 'svelte-awesome/icons/language';

	import debounce from 'lodash/debounce';
	import { speakerNames, editorMounted, duration, editor as editorStore, editorMode } from '$lib/stores';
	import { Change, ChangeSet, Span, simplifyChanges } from 'prosemirror-changeset';
	import { _, locale } from 'svelte-i18n';
	import { transactionsHaveChange } from '$lib/components/editor/api/transaction';
	import LanguageSelection from './toolbar/LanguageSelection.svelte';
	import PronounceLabel from './toolbar/PronLabel.svelte';
	import Download from './toolbar/Download.svelte';

	export let content;
	export let fileName;
	export let fileId;
	export let uploadedAt;
	export let demo;

	let element: HTMLDivElement | undefined;
	let editor: Readable<Editor>;

	const options: Intl.DateTimeFormatOptions = {
		/* weekday: "long", */ year: '2-digit',
		month: 'long',
		day: 'numeric'
	};
	$: uploadedAtFormatted = new Date(uploadedAt).toLocaleDateString($locale, options);
	$: durationSeconds = new Date(1000 * $duration).toISOString().substr(11, 8);

	const debouncedSave = debounce(handleSave, 5000, {
		leading: false,
		trailing: true
	});

	const date = new Date(0);
	date.setSeconds(45); // specify value for SECONDS here
	var timeString = date.toISOString().substring(11, 19);

	onMount(() => {
		editor = createEditor({
			/* element: element, */
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
						class: 'pron-label',
						multicolor: true
					}
				})
			],
			editorProps: {
				attributes: {
					class: 'm-5 focus:outline-none'
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
				if (!demo) debouncedSave();
				// console.log(editor.schema);
			}
		});
		editorStore.set($editor)
		editorMounted.set(true);
		let prevEditorDoc: Node = $editor.state.doc;
		const schema = $editor.schema;
	});

	onDestroy(() => {
		editorMounted.set(false);
		editorStore.set(null)
		if ($editor) {
			$editor.destroy();
		}
	});

	async function handleSave() {
		const result = await fetch(`/api/files/${fileId}`, {
			method: 'PUT',
			body: JSON.stringify($editor.getJSON())
		});
		if (!result.ok) {
			return false;
		}
		return true;
	}

	$: isActive = (name, attrs = {}) => $editor.isActive(name, attrs);
</script>

<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20" />
<div class="grid w-full mb-12 justify-center">
	<div class="stats stats-horizontal shadow mb-4">
		<div class="stat">
			<div class="stat-title">{fileName}</div>
			<div class="flex justify-between">
				<div class="w-1/2 stat-desc mr-3">{$_('file.duration')} {durationSeconds}</div>
				<div class="w-1/2 stat-desc">{$_('file.uploaded')} {uploadedAtFormatted}</div>
			</div>
		</div>

		<div class="stat">
			<fieldset>
				<legend class="stat-title">{$_('file.editingMode')}</legend>
				<div class="stat-desc flex flex-col">
					<label>
						<input type="radio" name="mode" value={1} bind:group={$editorMode} />
						{$_('file.editingModeRegular')}
					</label>
					<label>
						<input type="radio" name="mode" value={2} bind:group={$editorMode} />
						{$_('file.editingModeAnnotation')}
					</label>
				</div>
			</fieldset>
		</div>
	</div>
	<div class="editor max-w-5xl">
		{#if $editor}
			<div class="toolbar sticky top-0 z-10 pt-1 pb-1">
				<div class="flex items-center">
					<span
						on:click={() => $editor.chain().focus().undo().run()}
						class:disabled={!$editor.can().undo()}
						style="color: rgb(48, 49, 51);"
						class="ml-6 tooltip tooltip-bottom cursor-pointer"
						data-tip={$_('file.toolbarUndo')}
					>
						<Icon data={rotateLeft} scale={1.5} />
					</span>
					<span
						on:click={() => $editor.chain().focus().redo().run()}
						class:disabled={!$editor.can().redo()}
						style="color: rgb(48, 49, 51);"
						class="ml-3 tooltip tooltip-bottom cursor-pointer"
						data-tip={$_('file.toolbarRedo')}
					>
						<Icon data={rotateRigth} scale={1.5} />
					</span>
				</div>
				{#if $editorMode === 2}
					<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2" />
					<LanguageLabel {editor} />
					<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2" />
					<PronounceLabel {editor} />
				{/if}
				<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2" />
				<div class="flex items-center">
					<label for="download-modal"
							class="btn btn-link btn-sm flex"
						>
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
				<LanguageLabel editor={editor} />
				<div class="divider divider-horizontal ml-1 mr-1 sm:ml-2 sm:mr-2" />
				<PronounceLabel editor={editor} />
			</div>
		</BubbleMenu>
	{/if}
	<LanguageSelection />
	<Download></Download>
</div>

<style>
	.disabled {
		color: rgba(0, 0, 0, 0.54) !important;
	}
	.editor {
		box-shadow: rgb(0 0 0 / 9%) 0px 4px 4px 4px;
	}
	button.active {
		background: black;
		color: white;
	}
	.toolbar {
		display: flex;
		justify-content: space-around;
		background-color: #f5f5f5 !important;
		border-color: #f5f5f5 !important;
	}

	.my-bubble-menu {
		display: flex;
		justify-content: space-around;
		min-width: max-content;
		padding: 5px 5px;
		border-radius: var(--rounded-box, 0.5rem);
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
