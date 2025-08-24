<script lang="ts">
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import chevronLeft from 'svelte-awesome/icons/chevronLeft';
	import type { TranscriptSummary } from '@prisma/client';
	import type { Word, Speaker } from '$lib/helpers/converters/types';
	import { fromEstFormatAI } from '$lib/helpers/converters/estFormatAI';
	import { speakerNames as speakerNamesStore, words as wordsStore, editorMounted } from '$lib/stores.svelte.js';

	let { data } = $props();

	import { browser } from '$app/environment';
	// Dynamic imports to defer heavy components; avoid importing on server
	const editorModPromise: Promise<any> = browser ? import('$lib/components/editor/TiptapAI.svelte') : new Promise(() => {});
	const playerModPromise: Promise<any> = browser ? import('$lib/components/Player.svelte') : new Promise(() => {});
	const sidebarModPromise: Promise<any> = browser ? import('$lib/components/transcript-sidebar/TranscriptSidebar.svelte') : new Promise(() => {});

	// Kick off transcript fetch for progressive load (client only)
	const transcriptPromise: Promise<any> = browser
		? fetch(`/api/files/${data.file.id}`, { headers: { accept: 'application/json' } })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Transcript ${r.status}`))))
		: new Promise(() => {});

	// Apply transcript after it loads — outside of template to avoid state_unsafe_mutation
	$effect(() => {
		if (browser) {
			transcriptPromise
				.then((json) => applyTranscript(json))
				.catch(() => {/* handled by await/catch UI */});
		}
	});

	let words = $state<Array<Word>>([]);
	let speakers = $state<Array<Speaker>>([]);
	let summary = $state<TranscriptSummary | null>(null);
	let sidebarCollapsed = $state(false);
	let editorRef: any;
	let pendingDoc: any = null;

	function handleSummaryGenerated(newSummary: TranscriptSummary) {
		summary = newSummary;
	}

	function processTranscript(raw: any) {
		let doc: any = { type: 'doc', content: [] };
		let w: Array<Word> = [];
		let s: Array<Speaker> = [];
		if (!raw) return { doc, w, s };
		// If first-time Estonian JSON format
		if (raw && !raw.type) {
			const converted = fromEstFormatAI(raw);
			({ transcription: doc, words: w, speakers: s } = converted);
		}
		// Already in Editor format (AI with wordNode items)
		else if (raw && raw.content) {
			doc = raw;
			if (Array.isArray(raw.content)) {
				raw.content.forEach((node: any) => {
					let start = -1; let end = -1;
					if (node.content && node.content.length > 0) {
						const firstWordNode = node.content.find((n: any) => n.type === 'wordNode');
						if (firstWordNode?.attrs) start = firstWordNode.attrs.start ?? -1;
						const lastWordNode = [...node.content].reverse().find((n: any) => n.type === 'wordNode');
						if (lastWordNode?.attrs) end = lastWordNode.attrs.end ?? -1;
					}
					if (node.attrs) s.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
					if (node.content) {
						node.content.forEach((inlineNode: any) => {
							if (inlineNode.type === 'wordNode' && inlineNode.attrs) {
								w.push({ start: inlineNode.attrs.start, end: inlineNode.attrs.end, id: inlineNode.attrs.id });
							}
						});
					}
				});
			}
		}
		return { doc, w, s };
	}

	function applyTranscript(raw: any) {
		if (!raw || raw.error) return;
		const { doc, w, s } = processTranscript(raw);
		words = w; speakers = s;
		speakerNamesStore.set(speakers);
		wordsStore.set(words);
		if (editorRef?.setContent) editorRef.setContent(doc);
		else pendingDoc = doc;
	}

	$effect(() => {
		if (editorRef && pendingDoc) {
			editorRef.setContent(pendingDoc);
			pendingDoc = null;
		}
	});

	// Allow sidebar to re-open from children
	$effect(() => {
		const onOpen = () => {
			sidebarCollapsed = false;
		};
		window.addEventListener('openTranscriptSidebar', onOpen);
		return () => window.removeEventListener('openTranscriptSidebar', onOpen);
	});

	// Broadcast collapsed state
	$effect(() => {
		const collapsedState = sidebarCollapsed;
		window.dispatchEvent(new CustomEvent('transcriptSidebarCollapsed', { detail: { collapsed: collapsedState } }));
	});
</script>

<header class="ai-header">
	<div class="container">
		<h1 class="title">{data.file.name}</h1>
		<p class="meta">{data.file.language} · {new Date(data.file.uploadedAt).toLocaleString()}</p>
	</div>
</header>

<main class="transcript-layout {sidebarCollapsed ? 'sidebar-collapsed' : ''}">
	<div class="content-area">
		<div class="editor-pane">
			<div class="editor-content">
				{#if sidebarCollapsed}
					<div class="expand-sidebar-stick">
						<button class="expand-sidebar-btn" title="Open sidebar" onclick={() => (sidebarCollapsed = false)}>
							<Icon data={chevronLeft} />
						</button>
					</div>
				{/if}

				{#await editorModPromise}
					<div class="editor-skeleton shimmer"></div>
				{:then mod}
					<mod.default bind:this={editorRef}
						initialContent={{ type: 'doc', content: [{ type: 'paragraph' }] }}
						fileId={data.file.id}
						demo={false}
						fileName={data.file.name}
						uploadedAt={data.file.uploadedAt}
						{summary}
						onSummaryGenerated={handleSummaryGenerated}
					/>
				{/await}

				{#await transcriptPromise}
					<div class="paragraph-skeleton shimmer"></div>
				{:then transcriptJson}
					<!-- transcript loaded; content will be applied via effect to avoid state mutation in template -->
				{/await}
			</div>
		</div>

		<aside>
			{#await sidebarModPromise}
				<div class="sidebar-skeleton shimmer"></div>
			{:then Sidebar}
				<Sidebar.default
					fileId={data.file.id}
					editorContent={null}
					audioFilePath={data.file.path}
					{summary}
					collapsed={sidebarCollapsed}
					onCollapsedChange={(value) => (sidebarCollapsed = value)}
				/>
			{/await}
		</aside>
	</div>

	<div class="player-area">
		{#await playerModPromise}
			<div class="player-skeleton shimmer"></div>
		{:then Player}
			<Player.default url={`${data.url}/uploaded/${data.file.id}`} />
		{/await}
	</div>
</main>

<style>
	:root { --player-height: 140px; --sidebar-width: clamp(320px, 28vw, 420px); }
	.ai-header { padding: 12px 16px; background: white; border-bottom: 1px solid #e5e7eb; }
	.ai-header .title { margin: 0; font-size: 1.1rem; font-weight: 600; }
	.ai-header .meta { margin: 2px 0 0 0; color: #6b7280; font-size: 0.9rem; }
	.shimmer { position: relative; overflow: hidden; background: #f3f4f6; }
	.shimmer::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.6) 50%, rgba(255,255,255,0) 100%); animation: shimmer 1.2s infinite; }
	@keyframes shimmer { 100% { transform: translateX(100%); } }
	.editor-skeleton { height: 48vh; border-radius: 8px; margin: 12px; }
	.paragraph-skeleton { height: 12px; margin: 8px 16px; border-radius: 6px; }
	.sidebar-skeleton { width: var(--sidebar-width); height: 48vh; border-radius: 8px; margin: 12px; }
	.player-skeleton { height: 64px; }
	.transcript-layout { display: flex; flex-direction: column; width: 100%; min-height: 100vh; padding-bottom: var(--player-height, 140px); }
	.content-area { display: grid; grid-template-columns: 1fr var(--sidebar-width); transition: grid-template-columns 0.2s ease; flex: 1; gap: 0; }
	.transcript-layout.sidebar-collapsed .content-area { grid-template-columns: 1fr; }
	.editor-pane { background: #f8f9fa; }
	.editor-content { background: #f8f9fa; position: relative; }
	.expand-sidebar-stick { position: sticky; top: 12px; z-index: 900; display: flex; justify-content: flex-end; pointer-events: none; }
	.expand-sidebar-btn { pointer-events: auto; margin-right: 8px; background: white; border: 1px solid #e5e7eb; border-radius: 9999px; padding: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.12); cursor: pointer; }
	.player-area { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #e5e7eb; background: white; z-index: 1000; }
	@media (max-width: 1024px) { .content-area { grid-template-columns: 1fr; } .transcript-layout { padding-bottom: var(--player-height, 160px); } }
</style>
