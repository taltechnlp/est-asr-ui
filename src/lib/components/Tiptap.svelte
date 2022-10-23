<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor, getDebugJSON } from '@tiptap/core';
	import type { Node, Schema } from 'prosemirror-model';
	import Document from '@tiptap/extension-document';
	// import { CustomParagraph } from '$lib/customParagraph';
	// import Paragraph from '@tiptap/extension-paragraph';
	// import Heading from '@tiptap/extension-heading';

	import Text from '@tiptap/extension-text';
	import DropCursor from '@tiptap/extension-dropcursor';
	import GapCursor from '@tiptap/extension-gapcursor';
	import TextStyle from '@tiptap/extension-text-style';
	import Highlight from '@tiptap/extension-highlight';
	/* import StarterKit from '@tiptap/starter-kit'; */
	// import type {Readable} from 'svelte/store'
	import History from '@tiptap/extension-history';
	import { Speaker } from './speaker';
	import { Word } from './word';
	import {WordColor} from './wordColor'
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotate-left';
	import rotateRigth from 'svelte-awesome/icons/rotate-right';
	import download from 'svelte-awesome/icons/download';
	import debounce from 'lodash/debounce';
	import { downloadHandler } from '$lib/download';
	import { speakerNames, editorMounted } from '$lib/stores';
	import { Change, ChangeSet, Span, simplifyChanges } from 'prosemirror-changeset'
	import { _ } from 'svelte-i18n';
	import { transactionsHaveChange } from '$lib/components/editor/api/transaction';

	export let content;
	export let fileId;
	export let demo;

	let element: HTMLDivElement | undefined;
	let editor: undefined | Editor;

	const debouncedSave = debounce(handleSave, 5000, {
		leading: false,
		trailing: true
	});

	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				Document,
				DropCursor,
				GapCursor,
				Text,
				TextStyle,
				History,
				Word,
				WordColor,
				Speaker /* ,
				Highlight.configure({
					HTMLAttributes: {
						class: 'playing'
					}
				}) */
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

			onTransaction: ({editor, transaction}) => {
				// force re-render so `editor.isActive` works as expected
				// editor = editor;

				const speakerChanged = (node: Node) => node.type === schema.nodes.speaker;
				const speakerChanges = transactionsHaveChange([transaction], prevEditorDoc, transaction.doc, speakerChanged)
				prevEditorDoc = transaction.doc 
				// console.log(speakerChanges)
				// console.log(transaction, editor.state)
				if (!demo) debouncedSave();
				// console.log(editor.schema);
			}
		});
		editorMounted.set(true);
		let prevEditorDoc: Node = editor.state.doc;
		const schema = editor.schema
		window.myEditor = editor;
	});

	onDestroy(() => {
		editorMounted.set(false);
		if (editor) {
			editor.destroy();
		}
	});

	async function handleSave() {
		const result = await fetch(`/api/files/${fileId}`, {
			method: "PUT",
			body: JSON.stringify(editor.getJSON())
		});
		if (!result.ok) {
			return false;
		}
		return true;
	}

/* 	const getSpeakerNames = (content) => {
		let speakerNames = new Set();
		if (content.content) {
			content.content.forEach((node) =>
				node.attrs['data-name'] ? speakerNames.add(node.attrs['data-name']) : null
			);
		} else {
		}
		return Array.from(speakerNames);
	}; */
</script>

<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20" />
<div class="grid w-full mt-4 mb-12 justify-center">
	<div class="editor">
		{#if editor}
			<div class="toolbar sticky top-0 z-10 pt-1 pb-1">
				<div>
					<span
						on:click={() => editor.chain().focus().undo().run()}
						class:disabled={!editor.can().undo()}
						style="color: rgba(0, 0, 0, 0.54);"
						class="ml-6 tooltip tooltip-bottom cursor-pointer"
						data-tip={$_('file.toolbarUndo')}
					>
						<Icon data={rotateLeft} scale={1.5} />
					</span>
					<span
						on:click={() => editor.chain().focus().redo().run()}
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
						on:click={() => {
							downloadHandler(editor.getJSON(), '', '', true);
						}}
					>
						<Icon data={download} scale={1} />
						<span class="ml-2"> {$_('file.toolbarDownload')} </span>
					</button>
				</div>
			</div>
		{/if}
		<div bind:this={element} id="myEditor" class="max-w-5xl " />
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
