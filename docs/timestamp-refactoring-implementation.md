# Timestamp Refactoring Implementation

## Overview

This document describes the refactoring of the TipTap/ProseMirror editor to remove timestamp data from word nodes and implement a cleaner separation of concerns using the Word Index Map Method.

## Motivation

Previously, every word node in the editor stored `start` and `end` timing attributes directly on the node. This approach had several drawbacks:

- **Bloated Schema**: Document structure contained timing metadata, making it complex
- **Edit Fragility**: User edits could corrupt timing data
- **Inefficient**: Required traversing the document tree for playback highlighting
- **Coupling**: Timing data was tightly coupled with document structure

## Solution: Word Index Map Method

The new approach follows the pattern described in `timestamp_rework.md`:

1. **Static Timing Array**: Immutable source of truth stored outside the document
2. **Position Mapping Plugin**: Maintains `Map<wordIndex, docPosition>` automatically
3. **Simplified Document**: Plain text with minimal inline nodes (just wordIndex reference)
4. **Binary Search Playback**: Fast O(log n) lookup instead of tree traversal

## Implementation Details

### 1. Word Timing Plugin (`src/lib/components/plugins/wordTimingPlugin.ts`)

**Purpose**: Manages timing data separately from the document structure.

**Key Features**:
- Stores immutable `WordTiming[]` array with `{ start, end }` objects
- Maintains `Map<wordIndex, docPosition>` that updates on every transaction
- Provides helper functions:
  - `findWordIndexForTime(timingArray, time)`: Binary search to find word at playback time
  - `getPositionForTime(editor, time)`: Get document position for playback time
  - `getTimingForPosition(editor, pos)`: Get timing data for document position

**Plugin State**:
```typescript
interface TimingPluginState {
  timingArray: WordTiming[];        // Immutable timing source
  wordPositionMap: Map<number, number>; // wordIndex -> docPosition
}
```

**Auto-Updates**: The plugin's `apply` function rebuilds the position map on every document change by traversing nodes and mapping `wordIndex` attributes to positions.

### 2. Simplified WordNode (`src/lib/components/nodes/word-ai.ts`)

**Before**:
```typescript
attrs: {
  start: number,
  end: number,
  id: string,
  lang: string,
  spellcheck: string
}
```

**After**:
```typescript
attrs: {
  wordIndex: number  // Only attribute - references timingArray
}
```

**Changes**:
- Removed all timing-related attributes (`start`, `end`)
- Removed metadata attributes (`id`, `lang`, `spellcheck`)
- Removed Svelte component (`WordNode.svelte`) - uses plain HTML rendering
- Removed `updateWordTiming` command (no longer needed)

### 3. ASR Converters

#### `src/lib/helpers/converters/newEstFormatAI.ts`

**Updated Function**:
```typescript
const combineWords = (words: Array<Word>, timingArray: WordTiming[]) =>
  (acc: any[], word: { word_with_punctuation: string; start: number; end: number }) => {
    const wordIndex = timingArray.length;

    // Store timing separately
    timingArray.push({ start: word.start, end: word.end });

    // Create simplified node
    return acc.concat({
      type: 'wordNode',
      attrs: { wordIndex },
      content: [{ type: 'text', text: word.word_with_punctuation }]
    });
  };
```

**Return Value**:
```typescript
{
  transcription: { type: 'doc', content: [...] },
  timingArray: WordTiming[],  // NEW: Separate timing array
  words: Word[],              // Legacy compatibility
  speakers: Speaker[],
  metadata: { ... }
}
```

#### `src/lib/helpers/converters/estFormatAI.ts`

Similar changes applied to the legacy EST format converter for consistency.

### 4. Word Playback Plugin (`src/lib/components/plugins/wordPlaybackPlugin.ts`)

**Purpose**: Handles audio playback highlighting and click-to-seek functionality.

**Replaces**: `wordColorAI.ts` (old implementation that read timing from node attributes)

**Key Features**:

1. **Playback Highlighting**:
   - Receives playback time via transaction metadata
   - Binary searches timing array to find current word index
   - Looks up position from timing plugin's map
   - Applies decorations for visual highlighting

2. **Click-to-Seek**:
   - Detects clicks on word nodes
   - Extracts `wordIndex` from node attributes
   - Looks up timing from timing plugin
   - Seeks audio player to word's start time

**Helper Function**:
```typescript
export function updatePlaybackPosition(editor: any, time: number) {
  editor.view.dispatch(
    editor.state.tr.setMeta('playback', { time })
  );
}
```

**Decoration Strategy**:
- Gray text (`color: #9b9b9b`) for words before current position
- Blue highlighted text (`color: #70acc7`) for current word
- Decorations update via ProseMirror's efficient decoration system

### 5. TiptapAI Editor Component (`src/lib/components/editor/TiptapAI.svelte`)

**New Props**:
```typescript
interface Props {
  // ... existing props
  timingArray?: WordTiming[];  // NEW: Timing data
}
```

**Editor Initialization**:
```typescript
extensions: [
  // ... other extensions
  WordNode,
  WordTimingPlugin.configure({
    timingArray: timingArray  // Initialize with timing data
  }),
  WordPlaybackPlugin,  // Replace WordColorAI
  // ... other extensions
]
```

**Playback Updates**:
```typescript
// Poll playback position every 100ms when playing
$effect(() => {
  if ($waveform && $waveform.player && $editor && $player.playing) {
    playbackInterval = setInterval(() => {
      const currentTime = $waveform.player.getCurrentTime();
      updatePlaybackPosition($editor, currentTime);
    }, 100);

    return () => clearInterval(playbackInterval);
  }
});
```

### 6. Page Component (`src/routes/files/ai/[fileId]/+page.svelte`)

**Data Flow**:
```typescript
// Extract timing array from ASR conversion
if (json && !json.type) {
  content = fromEstFormatAI(json);
  ({ transcription, words, speakers, timingArray } = content);
}

// Pass to editor
<TiptapAI
  content={transcription}
  {timingArray}
  // ... other props
/>
```

**Backward Compatibility**:
The page handles both formats:
- **New Format**: Uses `wordIndex` to look up timing in `timingArray`
- **Legacy Format**: Reads `start`/`end` from node attributes, rebuilds `timingArray`

## Benefits Achieved

### ✅ Clean Document Schema
Word nodes now only contain a reference number (`wordIndex`) instead of complex timing attributes. The document structure is simpler and more maintainable.

### ✅ Edit-Resilient
User edits don't affect timing data since it's stored separately. When a word is deleted, the timing stays intact in the array - only the position map is updated.

### ✅ Efficient Lookup
Binary search on sorted timing array: **O(log n)** vs tree traversal: **O(n)**

For a 1-hour transcript (~10,000 words):
- Old approach: ~10,000 operations
- New approach: ~14 operations (log₂ 10,000)

### ✅ Separation of Concerns
Clear separation between:
- **Immutable Data**: Timing array (source of truth)
- **Mutable Document**: Editor content (user-editable)
- **Dynamic Mapping**: Position map (auto-maintained by plugin)

## File Changes Summary

### New Files
- `src/lib/components/plugins/wordTimingPlugin.ts` - Timing management plugin
- `src/lib/components/plugins/wordPlaybackPlugin.ts` - Playback and highlighting

### Modified Files
- `src/lib/components/nodes/word-ai.ts` - Simplified WordNode (removed timing attrs)
- `src/lib/helpers/converters/newEstFormatAI.ts` - Returns timing array separately
- `src/lib/helpers/converters/estFormatAI.ts` - Returns timing array separately
- `src/lib/components/editor/TiptapAI.svelte` - Uses new plugins and timing approach
- `src/routes/files/ai/[fileId]/+page.svelte` - Passes timing array to editor

### Removed Dependencies
- `src/lib/components/nodes/WordNode.svelte` - No longer needed (plain HTML rendering)
- `src/lib/components/plugins/wordColorAI.ts` - Replaced by wordPlaybackPlugin

## Testing Recommendations

1. **Basic Playback**: Verify word highlighting during audio playback
2. **Click-to-Seek**: Test clicking words to seek audio
3. **Edit Resilience**: Edit text and verify timing still works
4. **Word Deletion**: Delete words and verify playback still functions
5. **Word Addition**: Add new words (should be ignored by playback)
6. **Binary Search**: Test edge cases (start, middle, end of transcript)
7. **Legacy Format**: Test files with old format (should convert to new format)

## Future Enhancements

- **Persistence**: Store `timingArray` separately in database for faster loading
- **Word Alignment**: Add support for word-level alignment corrections
- **Multi-language**: Extend timing system for multi-language transcripts
- **Export**: Include timing data in DOCX/EST format exports

## References

- Original design: `/home/aivo/dev2/est-asr-ui/timestamp_rework.md`
- ProseMirror Decorations: https://prosemirror.net/docs/ref/#view.Decoration
- Binary Search Complexity: https://en.wikipedia.org/wiki/Binary_search_algorithm
