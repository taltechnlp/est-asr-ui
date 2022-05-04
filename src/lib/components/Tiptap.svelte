<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	// @ts-ignore
	import { Editor, getDebugJSON } from '@tiptap/core';
	// @ts-ignore
	import Document from '@tiptap/extension-document';
	// import { CustomParagraph } from '$lib/customParagraph';
	// import Paragraph from '@tiptap/extension-paragraph';
	// import Heading from '@tiptap/extension-heading';
	// @ts-ignore
	import Text from '@tiptap/extension-text';
	import DropCursor from '@tiptap/extension-dropcursor';
	import GapCursor from '@tiptap/extension-gapcursor';
	/* import StarterKit from '@tiptap/starter-kit'; */
	// import type {Readable} from 'svelte/store'
	// @ts-ignore
	import History from '@tiptap/extension-history';
	import { Speaker } from './speaker';
	import { Word } from './word';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotate-left';
	import rotateRigth from 'svelte-awesome/icons/rotate-right';
	import download from 'svelte-awesome/icons/download';
	import debounce from 'lodash/debounce';
	import { downloadHandler } from '$lib/download';
	import { saveChanges } from '$lib/mutations/save';
	import { speakerNames } from '$lib/stores';
	import { _ } from 'svelte-i18n';

	export let content;
	export let fileId;
	export let demo;

	let element;
	let editor;

	const debouncedSave = debounce(handleSave, 10000, {
		leading: false,
		trailing: true
	});

	onMount(() => {
		speakerNames.set([]);
		editor = new Editor({
			element: element,
			extensions: [
				Document,
				DropCursor,
				GapCursor,
				Text,
				/*                 Heading.configure({
                  levels: [1, 2, 3],
                }), */
				History,
				Word,
				Speaker
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

			onTransaction: () => {
				// force re-render so `editor.isActive` works as expected
				editor = editor;
				if (!demo) debouncedSave();
				// console.log(editor.schema);
			}
		});
		const names = getSpeakerNames();
		// @ts-ignore
		speakerNames.set(names);

		function handleWordClick(e) {
			// @ts-ignore
			if (window.myPlayer) {
				// @ts-ignore
				const startTime = parseFloat(e.target.getAttribute('start'));
				if (startTime) {
					// @ts-ignore
					const location = startTime / window.myPlayer.getDuration();
					// @ts-ignore
					window.myPlayer.seekAndCenter(location);
				}
			}
		}

		const words = new Map();
		document.querySelectorAll('span[start]').forEach((el) => {
			const start = Math.round(parseFloat(el.getAttribute('start')) * 100);
			const end = Math.round(parseFloat(el.getAttribute('end')) * 100);
			for (let i = start; i <= end; i++) {
				words.set(i, el);
			}
			el.addEventListener('click', handleWordClick);
		});
		// @ts-ignore
		window.myEditor = editor;

		// @ts-ignore
		window.myEditorWords = words;
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});

	function handleSave() {
		saveChanges(editor.getJSON(), fileId);
	}

	const getSpeakerNames = () => {
		const speakerNodes = editor.view.state.doc.content;
		let speakerNames = new Set();
		speakerNodes.forEach((node) =>
			node.attrs['data-name'] ? speakerNames.add(node.attrs['data-name']) : null
		);
		return Array.from(speakerNames);
	};
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
						class="ml-4 tooltip tooltip-bottom cursor-pointer"
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
							downloadHandler('', '', '', true);
						}}
					>
						<Icon data={download} scale={1} />
						<span class="ml-2"> {$_('file.toolbarDownload')} </span>
					</button>
				</div>
			</div>
		{/if}
		<div bind:this={element} class="max-w-5xl " />
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
