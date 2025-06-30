<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { useNodeViewContext } from '@prosemirror-adapter/svelte';

  const dispatch = createEventDispatcher();

  // Access ProseMirror context via reactive Svelte stores
  const nodeStore = useNodeViewContext('node');
  const selectedStore = useNodeViewContext('selected');
  // contentDOM will be handled by ProseMirror automatically for non-atomic nodes

  // Reactively derive props from the node's attributes
  let timecode = $derived($nodeStore.attrs.timecode);
  let identifier = $derived($nodeStore.attrs.identifier);

  const handleClick = (event: MouseEvent) => {
    // Get the current text content from the DOM
    const target = event.currentTarget as HTMLElement;
    const wordText = target?.textContent || '';
    dispatch("wordclick", { timecode, identifier, text: wordText });
  };
</script>

<style>
  .word {
    cursor: pointer;
    display: inline;
    padding: 0.1rem;
    margin: 0 0.1rem;
    border-radius: 3px;
    transition: background-color 0.2s;
  }

  .word:hover {
    background-color: #e0e0e0;
  }

  .selected {
    background-color: #d0f0fd;
  }

  .is-playing {
    background-color: #ffd700;
  }


</style>

<span
  class="word"
  class:selected={$selectedStore}
  on:click={handleClick}
  role="button"
  tabindex="0"
  title="Click to jump to timecode"
></span>

