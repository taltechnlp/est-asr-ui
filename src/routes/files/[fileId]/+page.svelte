<script lang="ts">
	import Tiptap from '$lib/components/editor/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
	import { fromEstFormat } from '$lib/helpers/converters/estFormat';
	import { _ } from 'svelte-i18n';
	import {
		speakerNames as speakerNamesStore,
		words as wordsStore,
		editorMounted
	} from '$lib/stores.svelte.js';
	import type { Speaker, Word } from '$lib/helpers/converters/types';
	import type { PageProps } from './$types';

	interface EditorContent {
		transcription: any;
		words: Array<Word>;
		speakers: Array<Speaker>;
	}

	let { data }: PageProps = $props();

	let loadedFileId = '';
	let loadVersion = 0;
	const pendingEditorContent = new Promise<EditorContent>(() => {});
	let editorContentPromise = $state<Promise<EditorContent>>(pendingEditorContent);

	function parseContent(rawContent: string): EditorContent {
		const words: Array<Word> = [];
		const speakers: Array<Speaker> = [];
		let transcription: any = '';
		const json = JSON.parse(rawContent);

		// First time transcription from the Estonian JSON format.
		if (json && !json.type) {
			const content = fromEstFormat(json);
			return {
				transcription: content.transcription,
				words: content.words,
				speakers: content.speakers
			};
		}

		// Already in editor format.
		if (json && json.content) {
			json.content.forEach((node: any) => {
				const start = node.content?.[0]?.marks?.[0]?.attrs?.start ?? -1;
				const end = node.content?.[node.content.length - 1]?.marks?.[0]?.attrs?.end ?? -1;

				speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
				if (!node.content) {
					return;
				}

				node.content.forEach((inlineNode: any) => {
					if (inlineNode.type === 'text' && inlineNode.marks?.length > 0) {
						inlineNode.marks.forEach((mark: any) => {
							if (mark.type === 'word') {
								words.push({ start: mark.attrs.start, end: mark.attrs.end, id: mark.attrs.id });
							}
						});
					}
				});
			});
			transcription = json;
		} else {
			transcription = json; // Empty editor.
		}

		return { transcription, words, speakers };
	}

	async function loadEditorContent(fileId: string, version: number): Promise<EditorContent> {
		const response = await fetch(`/api/files/${fileId}`, {
			cache: 'no-store'
		});
		if (!response.ok) {
			throw new Error(`failed_to_fetch_content_${response.status}`);
		}
		const rawContent = await response.text();

		// Yield to the browser once so the loading state can paint before heavy parsing.
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const parsedContent = parseContent(rawContent);

		if (version === loadVersion) {
			speakerNamesStore.set(parsedContent.speakers);
			wordsStore.set(parsedContent.words);
		}

		return parsedContent;
	}

	$effect(() => {
		if (loadedFileId === data.file.id) {
			return;
		}

		loadedFileId = data.file.id;
		loadVersion += 1;
		const version = loadVersion;
		editorMounted.set(false);
		speakerNamesStore.set([]);
		wordsStore.set([]);
		editorContentPromise = loadEditorContent(data.file.id, version);
	});
</script>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		{#await editorContentPromise}
				<div class="grid h-[55vh] min-h-80 place-items-center">
					<div class="flex items-center gap-3 text-base-content/70">
						<span
							class="loading loading-spinner loading-lg animate-spin"
							aria-hidden="true"
						></span>
						<span>{$_('editor.loadingContent')}</span>
					</div>
				</div>
		{:then editorContent}
			<Tiptap
				content={editorContent.transcription}
				fileId={data.file.id}
				demo={false}
				fileName={data.file.name}
				uploadedAt={data.file.uploadedAt}
			/>
		{:catch loadError}
			<div role="alert" class="alert alert-error max-w-5xl">
				<span>Failed to load editor content ({loadError?.message ?? 'unknown_error'}).</span>
			</div>
		{/await}
		<Player url={`/uploaded/${data.file.id}`} mimeType={data.file.mimetype} />
	</div>
</main>
