<script lang="ts">
	import Tiptap from '$lib/components/editor/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
	import { fromDelta } from '$lib/helpers/converters/deltaFormat';
	import { fromEstFormat } from '$lib/helpers/converters/estFormat';
	import {
		speakerNames as speakerNamesStore,
		words as wordsStore,
		editorMounted
	} from '$lib/stores';
	import type { Word, Speaker } from '$lib/helpers/converters/types';
	let { data } = $props();
	let words: Array<Word> = [];
	let speakers: Array<Speaker> = [];
	let transcription = $state('');
	let json = JSON.parse(data.file && data.file.content);
	let content;
	// First time transcription from the Estonian JSON format.
	if (json && !json.type) {
		content = fromEstFormat(json);
		({ transcription, words, speakers } = content);
	}
	// Already in Editor format
	else if (json && json.content) {
		json.content.forEach((node) => {
			const start =
				node.content &&
				node.content[0] &&
				node.content[0].marks &&
				node.content[0].marks[0] &&
				node.content[0].marks[0].attrs &&
				node.content[0].marks[0].attrs.start
					? node.content[0].marks[0].attrs.start
					: -1;
			const end =
				node.content && node.content[node.content.length-1] && node.content[node.content.length-1].marks && node.content[node.content.length-1].marks[0].attrs.end
				? node.content[node.content.length-1].marks[0].attrs.end
				: -1;
			speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
			if (node.content) {
				node.content.forEach((inlineNode) => {
					if (inlineNode.type === 'text' && inlineNode.marks && inlineNode.marks.length > 0) {
						inlineNode.marks.forEach((mark) => {
							if (mark.type == 'word') {
								words.push({ start: mark.attrs.start, end: mark.attrs.end, id: mark.attrs.id });
							}
						});
					}
				});
			}
		});
		transcription = json;
	} else transcription = json; // empty editor;
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words);
</script>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<Tiptap
			content={transcription}
			fileId={data.file.id}
			demo={false}
			fileName={data.file.name}
			uploadedAt={data.file.uploadedAt}
		/>
		<Player url={`${data.url}/uploaded/${data.file.id}`} />
	</div>
</main>
