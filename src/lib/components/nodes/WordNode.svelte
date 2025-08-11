<script lang="ts">
  import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap';
  import { waveform } from '$lib/stores.svelte';
  import type { Node as ProseMirrorNode } from 'prosemirror-model';
  
  interface Props {
    node: ProseMirrorNode;
    updateAttributes: (attrs: Record<string, any>) => void;
    selected: boolean;
  }
  
  let { node, updateAttributes, selected }: Props = $props();
  
  let ws = $state(null);
  $effect(() => {
    ws = $waveform;
  });
  
  // Extract attributes
  let start = $derived(node.attrs.start);
  let end = $derived(node.attrs.end);
  let id = $derived(node.attrs.id);
  let lang = $derived(node.attrs.lang || 'et');
  
  // Handle click to seek audio
  function handleClick(event: MouseEvent | KeyboardEvent) {
    if (start !== null && ws && ws.player) {
      ws.player.seek(start);
    }
  }
  
  // Determine if this word is currently playing
  let isPlaying = $state(false);
  let currentTime = $state(0);
  
  $effect(() => {
    if (ws && ws.player) {
      const unsubscribe = ws.player.on('timeupdate', () => {
        currentTime = ws.player.getCurrentTime();
        isPlaying = start !== null && end !== null && 
                   currentTime >= start && currentTime <= end;
      });
      
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  });
</script>

<span 
  class="word-node-wrapper {selected ? 'selected' : ''} {isPlaying ? 'playing' : ''}"
  data-id={id}
  data-start={start}
  data-end={end}
  data-lang={lang}
  onclick={handleClick}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick(e);
    }
  }}
  contenteditable="false"
>
  <NodeViewContent as="span" class="word-content" />
</span>

<style>
  .word-node-wrapper {
    display: inline;
    position: relative;
  }
  
  .word-content {
    display: inline;
    cursor: pointer;
    padding: 0 1px;
    border-radius: 2px;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  
  .word-content:hover {
    background-color: rgba(112, 172, 199, 0.1);
  }
  
  .word-node-wrapper.playing .word-content {
    background-color: rgba(112, 172, 199, 0.3);
    color: #2563eb;
  }
  
  .word-node-wrapper.selected .word-content {
    background-color: rgba(59, 130, 246, 0.2);
    outline: 1px solid rgba(59, 130, 246, 0.5);
  }
  
  /* Ensure proper spacing between words */
  .word-node-wrapper::after {
    content: ' ';
  }
</style>