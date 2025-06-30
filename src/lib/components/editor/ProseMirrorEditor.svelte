<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { EditorState } from 'prosemirror-state';
  import { EditorView } from 'prosemirror-view';
  import { history, undo as undoCommand, redo as redoCommand } from 'prosemirror-history';
  import { keymap } from 'prosemirror-keymap';
  import { baseKeymap } from 'prosemirror-commands';
  import { transcriptionSchema } from './schema';
  import { createHighlightPlugin, highlightWord, readSegment } from './highlightPlugin';
  import debounce from 'lodash/debounce';
  import {
    editorMounted,
    duration,
    editor as editorStore,
    editorMode,
    waveform, 
    fontSize as fontSizeStore,
    player
  } from '$lib/stores.svelte';
  import hotkeys from 'hotkeys-js';
  import { _, locale } from 'svelte-i18n';

  interface Props {
    content: any;
    fileName: any;
    fileId: any;
    uploadedAt: any;
    demo: any;
  }

  let {
    content,
    fileName,
    fileId,
    uploadedAt,
    demo
  }: Props = $props();

  const dispatch = createEventDispatcher();

  let editorElement: HTMLDivElement;
  let view: EditorView | null = $state(null);
  let currentFileId = $state(fileId);
  let hasUnsavedChanges = $state(false);
  let debouncedSave: any = $state();
  
  // Reactive undo/redo state
  let canUndoState = $state(false);
  let canRedoState = $state(false);

  // Watch for fileId changes
  $effect(() => {
    if (currentFileId !== fileId) {
      console.log('FileId changed from', currentFileId, 'to', fileId);
      if (debouncedSave) {
        debouncedSave.cancel();
        console.log('Cancelled debounced save for old fileId:', currentFileId);
      }
      hasUnsavedChanges = false;
      currentFileId = fileId;
      
      debouncedSave = debounce(handleSaveLocal, 5000, {
        leading: false,
        trailing: true
      });
      console.log('Created new debounced save for fileId:', fileId);
    }
  });

  // Initialize the debounced function
  $effect(() => {
    if (!debouncedSave) {
      debouncedSave = debounce(handleSaveLocal, 5000, {
        leading: false,
        trailing: true
      });
    }
  });

  const options: Intl.DateTimeFormatOptions = {
    year: '2-digit',
    month: 'long',
    day: 'numeric'
  };
  let uploadedAtFormatted = $derived(new Date(uploadedAt).toLocaleDateString($locale, options));
  let durationSeconds = $derived(new Date(1000 * $duration).toISOString().substr(11, 8));

  // Convert TipTap content to ProseMirror document
  function convertContentToProseMirror(content: any) {
    if (!content || !content.content) {
      return transcriptionSchema.node('doc', null, [
        transcriptionSchema.node('transcription_block', {
          speakerName: 'Speaker 1',
          speakerId: 'speaker1',
          topic: ''
        }, [
          transcriptionSchema.node('word', { 
            timecode: 0,
            identifier: 'word1'
          }, [transcriptionSchema.text('Hello')]),
          transcriptionSchema.text(' '),
          transcriptionSchema.node('word', { 
            timecode: 1,
            identifier: 'word2'
          }, [transcriptionSchema.text('world')])
        ]),
        transcriptionSchema.node('transcription_block', {
          speakerName: 'Speaker 2',
          speakerId: 'speaker2',
          topic: ''
        }, [
          transcriptionSchema.node('word', { 
            timecode: 2,
            identifier: 'word3'
          }, [transcriptionSchema.text('How')]),
          transcriptionSchema.text(' '),
          transcriptionSchema.node('word', { 
            timecode: 3,
            identifier: 'word4'
          }, [transcriptionSchema.text('are')]),
          transcriptionSchema.text(' '),
          transcriptionSchema.node('word', { 
            timecode: 4,
            identifier: 'word5'
          }, [transcriptionSchema.text('you?')])
        ])
      ]);
    }

    // Simple conversion - this might need to be more sophisticated based on your data structure
    const blocks = content.content.map((block: any) => {
      if (block.type === 'speaker' && block.content) {
        const words = block.content
          .filter((item: any) => item.type === 'text' && item.marks?.some((mark: any) => mark.type === 'word'))
          .map((item: any) => {
            const wordMark = item.marks.find((mark: any) => mark.type === 'word');
            return transcriptionSchema.node('word', {
              timecode: wordMark?.attrs?.timecode || 0,
              identifier: wordMark?.attrs?.identifier || ''
            }, [transcriptionSchema.text(item.text || '')]);
          });
        
        return transcriptionSchema.node('transcription_block', {
          speakerName: block.attrs?.['data-name'] || block.attrs?.speakerName || 'Unknown Speaker',
          speakerId: block.attrs?.id || block.attrs?.speakerId || '',
          topic: block.attrs?.topic || ''
        }, words);
      }
      return null;
    }).filter(Boolean);

    return transcriptionSchema.node('doc', null, blocks.length > 0 ? blocks : [
      transcriptionSchema.node('transcription_block', {
        speakerName: 'Unknown Speaker',
        speakerId: 'unknown',
        topic: ''
      }, [
        transcriptionSchema.node('word', { 
          timecode: 0,
          identifier: 'sample'
        }, [transcriptionSchema.text('Sample word')])
      ])
    ]);
  }

  onMount(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Create the initial document
    const doc = convertContentToProseMirror(content);

    // Create the editor state
    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap(baseKeymap),
        createHighlightPlugin()
      ]
    });

    // Create the editor view
    view = new EditorView(editorElement, {
      state,
      // Remove nodeViews - let ProseMirror handle word rendering directly
      attributes: {
        class: 'ProseMirror',
        spellcheck: 'false'
      },
      handleDOMEvents: {
        click: (view, event) => {
          const target = event.target as HTMLElement;
          if (target.classList.contains('word')) {
            const timecode = parseFloat(target.getAttribute('data-timecode') || '0');
            const identifier = target.getAttribute('data-identifier') || '';
            const text = target.textContent || '';
            
            console.log('Word clicked:', { timecode, identifier, text });
            dispatch('wordclick', { timecode, identifier, text });
            return true;
          }
          return false;
        }
      },
      dispatchTransaction: (transaction) => {
        if (!view) return;
        
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        // Update reactive undo/redo state
        canUndoState = undoCommand(newState);
        canRedoState = redoCommand(newState);

        // Track changes for auto-save
        if (!demo && currentFileId && transaction.docChanged) {
          console.log('Transaction detected for fileId:', currentFileId);
          hasUnsavedChanges = true;
          if (debouncedSave) {
            debouncedSave();
          }
        }
      }
    });

    // Set up the store and mounted state
    if (view) {
      editorStore.set(view);
      editorMounted.set(true);
      
      // Initialize undo/redo state
      canUndoState = undoCommand(view.state);
      canRedoState = redoCommand(view.state);
    }

    // Set up hotkeys
    hotkeys('tab', function(event, handler){
      event.preventDefault()
      if ($waveform) {
        if ($player && $player.playing) $waveform.player.pause();
        else if ($player && !$player.playing) $waveform.player.play();
      }
    });
    
    hotkeys('shift+tab', function(event, handler){
      event.preventDefault()
      if ($waveform) {
        $waveform.player.seek($waveform.player.getCurrentTime() - 1)
      }
    });
    
    hotkeys('alt+tab', function(event, handler){
      event.preventDefault()
      if ($waveform) {
        $waveform.player.seek($waveform.player.getCurrentTime() + 1)
      }
    });

    // Undo/Redo keyboard shortcuts
    hotkeys('ctrl+z,cmd+z', function(event, handler){
      event.preventDefault();
      undo();
    });
    
    hotkeys('ctrl+y,cmd+y,ctrl+shift+z,cmd+shift+z', function(event, handler){
      event.preventDefault();
      redo();
    });

    // Word clicks are now handled directly in ProseMirror's handleDOMEvents
  });

  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (debouncedSave) {
      debouncedSave.cancel();
    }
    hotkeys.unbind();
    editorMounted.set(false);
    editorStore.set(null);
    if (view) {
      view.destroy();
    }
  });

  async function handleSaveLocal() {
    if (!view || !currentFileId) {
      console.warn('Cannot save: missing view or fileId');
      return false;
    }

    if (currentFileId !== fileId) {
      console.warn('File changed during save, aborting save for:', currentFileId, 'current:', fileId);
      return false;
    }

    console.log('Attempting to save fileId:', currentFileId);
    const result = await handleSave();
    if (result) {
      hasUnsavedChanges = false;
      console.log('Successfully saved fileId:', currentFileId);
    } else {
      console.error('Failed to save fileId:', currentFileId);
    }
    return result;
  }

  beforeNavigate(async () => {
    console.log('beforeNavigate triggered', { hasUnsavedChanges, currentFileId, view: !!view, demo });
    
    if (debouncedSave) {
      debouncedSave.cancel();
    }
    
    if (hasUnsavedChanges && view && !demo && currentFileId) {
      console.log('Saving before navigation for fileId:', currentFileId);
      await handleSaveLocal();
    }
  });

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (hasUnsavedChanges && !demo) {
      if (debouncedSave) {
        debouncedSave.flush();
      }
      event.preventDefault();
      return event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }

  async function handleSave() {
    if (!view) return false;
    
    // Convert ProseMirror document back to JSON for saving
    const doc = view.state.doc;
    const content = {
      type: 'doc',
      content: []
    };

    // Convert document to saveable format
    doc.content.forEach((block) => {
      if (block.type.name === 'transcription_block') {
        const words: any[] = [];
        block.content.forEach((word) => {
          if (word.type.name === 'word') {
            // Extract text content from the word node
            const wordText = word.textContent || '';
            words.push({
              type: 'text',
              text: wordText,
              marks: [{
                type: 'word',
                attrs: {
                  timecode: word.attrs.timecode,
                  identifier: word.attrs.identifier
                }
              }]
            });
          }
        });
        
        content.content.push({
          type: 'speaker',
          attrs: {
            'data-name': block.attrs.speakerName,
            'id': block.attrs.speakerId,
            'topic': block.attrs.topic
          },
          content: words
        });
      }
    });

    const result = await fetch(`/api/files/${currentFileId}`, {
      method: 'PUT',
      body: JSON.stringify(content)
    }).catch(e => console.error("Saving file failed", currentFileId));
    
    if (!result || !result.ok) {
      return false;
    }
    return true;
  }

  // Public methods for external control
  export function highlightWordById(wordId: string | null) {
    if (view) {
      highlightWord(view, wordId);
    }
  }

  export function getWordsInRange(from?: number, to?: number) {
    if (view) {
      return readSegment(view, from, to);
    }
    return [];
  }

  export function canUndo() {
    return canUndoState;
  }

  export function canRedo() {
    return canRedoState;
  }

  export function undo() {
    if (view) {
      undoCommand(view.state, view.dispatch);
    }
  }

  export function redo() {
    if (view) {
      redoCommand(view.state, view.dispatch);
    }
  }

  let fontSize: string = $state(localStorage.getItem('fontSize') || "16");
  $effect(() => {
    fontSizeStore.set(fontSize)
  });
</script>

<div class="w-full fixed top-2 left-0 right-0 flex justify-center z-20"></div>
<div class="grid w-full mb-12 justify-center">
  <div class="stats stats-horizontal shadow mb-4">
    <div class="stat">
      <div class="stat-title">{fileName}</div>
      <div class="flex justify-between text-">
        <div class="w-1/2 stat-desc mr-3">{$_('file.duration')} {durationSeconds}</div>
        <div class="w-1/2 stat-desc">{$_('file.uploaded')} {uploadedAtFormatted}</div>
      </div>
    </div>

    <div class="stat">
      <fieldset>
        <legend class="stat-title">{$_('file.editingMode')}</legend>
        <div class="stat-desc flex flex-col">
          <label for="">
            <input type="radio" name="mode" value={1} bind:group={$editorMode} />
            {$_('file.editingModeRegular')}
          </label>
          <label for="">
            <input type="radio" name="mode" value={2} bind:group={$editorMode} />
            {$_('file.editingModeAnnotation')}
          </label>
        </div>
      </fieldset>
    </div>
  </div>
  
  <div class="editor max-w-5xl">
    {#if view}
      <div class="toolbar sticky top-0 z-10 pt-1 pb-1 bg-base-200">
        <div class="flex items-center">
          <button
            onclick={() => undo()}
            disabled={!canUndo()}
            class="btn btn-ghost"
          >
            Undo
          </button>
          <button
            onclick={() => redo()}
            disabled={!canRedo()}
            class="btn btn-ghost"
          >
            Redo
          </button>
        </div>
      </div>
    {/if}
    
    <div 
      bind:this={editorElement} 
      class="prosemirror-editor focus:outline-none"
      style="font-size: {fontSize}px;"
    ></div>
    
    {#if !view}
      <div class="flex items-center justify-center h-32 text-gray-500">
        Loading editor...
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.prosemirror-editor .word) {
    cursor: text;
    padding: 2px 4px;
    margin: 0 1px;
    border-radius: 3px;
    transition: background-color 0.2s;
    display: inline-block;
    border: 1px solid transparent;
  }

  :global(.prosemirror-editor .word:hover) {
    background-color: #e0e0e0;
    border-color: #ccc;
  }

  :global(.prosemirror-editor .word.selected) {
    background-color: #b3d4fc;
    border-color: #007acc;
  }

  :global(.prosemirror-editor .word.is-playing) {
    background-color: #fef08a;
    border-color: #f59e0b;
  }

  :global(.prosemirror-editor .speaker-block) {
    margin-bottom: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    background: #f9fafb;
  }

  :global(.prosemirror-editor .speaker-header) {
    background: #f3f4f6;
    padding: 0.5rem 1rem;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
  }

  :global(.prosemirror-editor .speaker-content) {
    padding: 1rem;
    background: white;
    min-height: 2rem;
  }

  :global(.prosemirror-editor) {
    min-height: 200px;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
  }

  /* ProseMirror base styles */
  :global(.ProseMirror) {
    position: relative;
    word-wrap: break-word;
    white-space: pre-wrap;
    white-space: break-spaces;
    -webkit-font-variant-ligatures: none;
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0; /* the above doesn't seem to work in Edge */
  }

  :global(.ProseMirror pre) {
    white-space: pre-wrap;
  }

  :global(.ProseMirror li) {
    position: relative;
  }

  :global(.ProseMirror-hideselection *::selection) {
    background: transparent;
  }
  :global(.ProseMirror-hideselection *::-moz-selection) {
    background: transparent;
  }
  :global(.ProseMirror-hideselection) {
    caret-color: transparent;
  }

  :global(.ProseMirror-selectednode) {
    outline: 2px solid #8cf;
  }

  /* Make sure li selections wrap around markers */
  :global(li.ProseMirror-selectednode) {
    outline: none;
  }

  :global(li.ProseMirror-selectednode:after) {
    content: "";
    position: absolute;
    left: -32px;
    right: -2px;
    top: -2px;
    bottom: -2px;
    border: 2px solid #8cf;
    pointer-events: none;
  }
</style> 