<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	// @ts-ignore
	import { Editor } from '@tiptap/core';
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

	let element;
	let editor;

	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				Document,
				DropCursor,
				GapCursor,
				/* Paragraph, */
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
			/* content: `<speaker data-name="Aivo Olev">
                </speaker>
                <speaker data-name="Raul Olev">test<span start="0.57" end="1.2"></span><span start="0.57" end="1.2"/></speaker>
                <speaker data-name="Eriti Pika Nimega Tolvan">test</speaker>
				<speaker data-name="Aivo Olev">test</speaker>
                      `, */
			content: `<speaker data-name="Aivo Olev">
                    <span start="0.57" end="1.2">Kavandatava</span> <span start="1.2" end="1.83">võimuliidu</span> <span start="1.83" end="2.4">erakondade</span> <span start="2.4" end="3.03">volikogud</span> <span start="3.51" end="3.81">heaks</span><span start="3.09" end="3.51">kiitsid</span>  <span start="3.81" end="4.8">koalitsioonileppe</span> <span start="4.83" end="5.07">ning</span> <span start="5.07" end="6.15">ministrikandidaadid.</span> <span start="6.51" end="7.08">Muuhulgas</span> <span start="7.08" end="7.35">läheb</span> <span start="7.35" end="8.22">koalitsioonileppe</span> <span start="8.22" end="8.49">ette</span> <span start="8.49" end="8.97">pensioni</span> <span start="8.97" end="9.27">teise</span> <span start="9.27" end="9.57">samba</span> <span start="9.57" end="10.14" confidence="76% kindlust" style="background-color: rgb(204, 232, 204);">reformi.</span>
                </speaker>
                <speaker data-name="Raul Olev">test<span start="0.57" end="1.2"></span><span start="0.57" end="1.2"/></speaker>
                <speaker data-name="Eriti Pika Nimega Tolvan">test</speaker>
				<speaker data-name="Aivo Olev">test</speaker>
                      `
			/* onTransaction: () => {
				// force re-render so `editor.isActive` works as expected
				editor = editor;
				console.log(editor.schema);
			} */
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});
</script>

{#if editor}
<div class="toolbar">
	<button
		on:click={() => editor.chain().focus().undo().run()}
		class:disabled={!editor.can().undo()} 
		>
		Undo
	</button>
	<button
		on:click={() => editor.chain().focus().redo().run()}
		class:disabled={!editor.can().redo()} 
		>
		Redo
	</button>
</div>
{/if}

<div class="flex flex-row w-full mt-4 mb-12 justify-center">
	<div bind:this={element} class="max-w-5xl" />
</div>

<style>
	button.active {
		background: black;
		color: white;
	}
	.toolbar {
		display: flex;
		justify-content: center;
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
