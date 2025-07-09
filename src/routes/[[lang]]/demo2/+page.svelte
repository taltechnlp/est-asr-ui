<script lang="ts">
	import Tiptap from '$lib/components/editor/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
	import { content, words, speakers } from './content';
	import { speakerNames as speakerNamesStore, words as wordsStore, editorMounted } from '$lib/stores.svelte';
	import { extractWordsFromEditor, extractTranscriptTitle } from '$lib/utils/extractWordsFromEditor';
	const file1 = {
		json: content,
		id: 1,
		name: 'Päevakaja 16.05.mp3',
		uploadedAt: new Date(22, 5, 22)
	};
	const file2 = {
		json: content,
		id: 2,
		name: 'Päevakaja 16.05.mp3',
		uploadedAt: new Date(22, 5, 22)
	};
	editorMounted.set(false);
	speakerNamesStore.set(speakers);
	wordsStore.set(words);

	// Sync handler for editors
	async function handleSync(editorContent: any, fileId: number) {
		console.log('🔄 [FRONTEND] Starting sync for fileId:', fileId);
		
		try {
			const words = extractWordsFromEditor(editorContent);
			const title = extractTranscriptTitle(editorContent);
			
			console.log('📊 [FRONTEND] Extracted data:', {
				transcriptId: `demo-transcript-${fileId}`,
				title,
				wordCount: words.length,
				sampleWords: words.slice(0, 3)
			});
			
			const response = await fetch('/api/convex/sync-transcript', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					transcriptId: `demo-transcript-${fileId}`,
					title,
					words
				})
			});

			console.log('📡 [FRONTEND] Response status:', response.status);
			console.log('📡 [FRONTEND] Response headers:', Object.fromEntries(response.headers.entries()));

			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ [FRONTEND] Response error:', errorText);
				throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
			}

			const result = await response.json();
			console.log('✅ [FRONTEND] Sync successful:', result);
		} catch (error) {
			console.error('❌ [FRONTEND] Sync failed:', error);
			throw error;
		}
	}
</script>

<svelte:head>
	<title>Demo | tekstiks.ee</title>
</svelte:head>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch mb-96">
		<Tiptap content={file1.json} fileId={file1.id} demo={true} fileName={file1.name} uploadedAt={file1.uploadedAt} onSync={handleSync} />
	</div>
	<div class="self-stretch mb-96">
		<Tiptap content={file2.json} fileId={file2.id} demo={true} fileName={file2.name} uploadedAt={file2.uploadedAt} onSync={handleSync} />
	</div>
</main>
