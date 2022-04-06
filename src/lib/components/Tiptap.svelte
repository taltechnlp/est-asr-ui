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
	import Icon from 'svelte-awesome/components/Icon.svelte'
	import rotateLeft from 'svelte-awesome/icons/rotate-left'
	import rotateRigth from 'svelte-awesome/icons/rotate-right'
	import download from 'svelte-awesome/icons/download'
	import { downloadHandler } from '$lib/download'

	export let content;

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
			content
			/* content: `<speaker data-name="Aivo Olev">
                    <span start="0.57" end="1.2">Kavandatava</span> <span start="1.2" end="1.83">võimuliidu</span> <span start="1.83" end="2.4">erakondade</span> <span start="2.4" end="3.03">volikogud</span> <span start="3.51" end="3.81">heaks</span><span start="3.09" end="3.51">kiitsid</span>  <span start="3.81" end="4.8">koalitsioonileppe</span> <span start="4.83" end="5.07">ning</span> <span start="5.07" end="6.15">ministrikandidaadid.</span> <span start="6.51" end="7.08">Muuhulgas</span> <span start="7.08" end="7.35">läheb</span> <span start="7.35" end="8.22">koalitsioonileppe</span> <span start="8.22" end="8.49">ette</span> <span start="8.49" end="8.97">pensioni</span> <span start="8.97" end="9.27">teise</span> <span start="9.27" end="9.57">samba</span> <span start="9.57" end="10.14" confidence="76% kindlust" style="background-color: rgb(204, 232, 204);">reformi.</span>
                </speaker>
                <speaker data-name="Raul Olev">test<span start="0.57" end="1.2"></span><span start="0.57" end="1.2"/></speaker>
                <speaker data-name="Eriti Pika Nimega Tolvan">test</speaker>
				<speaker data-name="Aivo Olev">test</speaker>
                      ` */
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
<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20">

	
</div>
<div class="grid w-full mt-4 mb-12 justify-center">
	<div class="editor">
		{#if editor}

		<div class="toolbar sticky top-0 z-10 pt-1 pb-1">
			<div></div>
			<div>
				<span on:click={() => editor.chain().focus().undo().run()}
					class:disabled={!editor.can().undo()} style="color: rgba(0, 0, 0, 0.54);" 
					class="ml-4 tooltip cursor-pointer" data-tip="undo">
					<Icon data={rotateLeft} scale="{1.5}" />
				</span>
				<span on:click={() => editor.chain().focus().redo().run()}
					class:disabled={!editor.can().redo()} style="color: rgba(0, 0, 0, 0.54);" 
					class="ml-4 tooltip cursor-pointer" data-tip="redo">
					<Icon data={rotateRigth} scale="{1.5}" />
				</span>
			</div>
			<div class="flex mt-1">
					<svg class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					<span>Salvestatud!</span>
			</div>
			<div class="flex">
				<button class="btn btn-link btn-sm" on:click="{()=>downloadHandler('','','')}">
					<Icon data={download} scale="{1}" />
					<span class="ml-2">
						Laadi alla
					</span> </button>
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
		background-color: #f5f5f5!important;
    	border-color: #f5f5f5!important;
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
