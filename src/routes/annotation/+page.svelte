<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { Editor, getDebugJSON } from '@tiptap/core';
	import Document from '@tiptap/extension-document';
	import Text from '@tiptap/extension-text';
	import DropCursor from '@tiptap/extension-dropcursor';
	import GapCursor from '@tiptap/extension-gapcursor';
	import TextStyle from '@tiptap/extension-text-style';
	import Highlight from '@tiptap/extension-highlight';
	import History from '@tiptap/extension-history';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import rotateLeft from 'svelte-awesome/icons/rotate-left';
	import rotateRigth from 'svelte-awesome/icons/rotate-right';
	import download from 'svelte-awesome/icons/download';
	import debounce from 'lodash/debounce';
	import { downloadHandler, handleSave } from '$lib/download';
	import { _ } from 'svelte-i18n';

	export let data: PageData;
	export let fileId: string;
	let element: HTMLDivElement | undefined;
	let editor: undefined | Editor;
	let demo = true;

	const debouncedSave = debounce(() => handleSave(editor, fileId), 5000, {
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
				History
				/* Word,
				WordColor,
				Speaker  */
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
			content: data.content,

			onTransaction: () => {
				// force re-render so `editor.isActive` works as expected
				// editor = editor;
				if (!demo) debouncedSave();
				// console.log(editor.schema);
			}
		});
	});
</script>
