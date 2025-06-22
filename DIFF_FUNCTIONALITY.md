# Diff Functionality for ASR Transcript Correction

This document describes the diff functionality implemented in the TiptapLLM.svelte component for displaying and managing LLM-proposed changes to ASR transcripts.

## Overview

The diff functionality allows the LLM to propose corrections to ASR transcripts with visual feedback showing:
- **Deletions**: Strikethrough text in red background
- **Additions**: Green highlighted text
- **Replacements**: Combination of deletion and addition

## Components

### 1. Diff Mark Extension (`src/lib/components/marks/diff.ts`)
- Custom Tiptap mark for handling diff visualization
- Supports `addition` and `deletion` types
- Includes reason tracking for each change

### 2. Diff Toolbar (`src/lib/components/editor/toolbar/DiffToolbar.svelte`)
- Toggle diff view on/off
- Apply all changes
- Reject all changes
- Refresh suggestions from LLM

### 3. Diff Commands API (`src/lib/components/editor/api/diffCommands.ts`)
- Comprehensive list of command types LLM can propose
- Functions for applying and visualizing diff commands
- Command validation utilities

### 4. API Endpoint (`src/routes/api/diff-suggestions/+server.ts`)
- Receives transcript content and returns LLM suggestions
- Currently returns mock data (to be replaced with actual LLM integration)

## LLM Command Types

The LLM can propose the following types of changes:

### Text Operations
- **replace**: Replace incorrect text with correct text
- **insert**: Add missing words, punctuation, or context
- **delete**: Remove filler words, repetitions, or artifacts

### Formatting
- **punctuation**: Fix punctuation marks and sentence boundaries
- **capitalization**: Fix capitalization rules
- **spacing**: Fix spacing and formatting issues

### Advanced
- **speaker_change**: Handle speaker identification and changes
- **grammar**: Fix grammatical errors
- **context**: Improve text based on surrounding context
- **translation**: Handle language-specific corrections

## Usage

### For Users
1. Open a transcript in the editor
2. Click the diff view toggle button (eye icon) in the toolbar
3. Review proposed changes highlighted in the text
4. Use "Apply All" to accept all changes or "Reject All" to discard them
5. Use "Refresh" to get new suggestions from the LLM

### For Developers
1. The diff functionality is integrated into `TiptapLLM.svelte`
2. To add new command types, extend the `DiffCommand` interface
3. To customize styling, modify the CSS classes in the component
4. To integrate with actual LLM, replace the mock API in `/api/diff-suggestions/+server.ts`

## API Integration

The LLM should return suggestions in this format:

```typescript
interface DiffSuggestion {
  id: string;
  commands: DiffCommand[];
  description: string;
  confidence: number;
  category?: 'spelling' | 'grammar' | 'punctuation' | 'speaker' | 'context' | 'translation' | 'formatting';
}

interface DiffCommand {
  id: string;
  type: 'replace' | 'insert' | 'delete' | 'speaker_change' | 'punctuation' | 'capitalization' | 'spacing' | 'grammar' | 'context' | 'translation';
  start: number;
  end: number;
  originalText?: string;
  newText?: string;
  reason: string;
  confidence: number;
  speakerId?: string;
  speakerName?: string;
  context?: string;
}
```

## Testing

The diff functionality can be tested on the LLM demo page:
- Navigate to `/llm-demo`
- Click the diff view toggle in the toolbar
- Example diff commands will be applied for demonstration

## Future Enhancements

1. **Individual Change Management**: Allow users to apply/reject individual changes
2. **Confidence Filtering**: Filter suggestions by confidence level
3. **Category-based Views**: Show only specific types of suggestions
4. **Batch Operations**: Apply changes in batches
5. **Undo/Redo Support**: Track diff operations in editor history
6. **Real-time Suggestions**: Get suggestions as user types
7. **Contextual Help**: Show explanations for suggested changes

## Integration with LangChain

To integrate with your LangChain pipeline:

1. Replace the mock API in `/api/diff-suggestions/+server.ts`
2. Send transcript content to your LLM
3. Parse LLM response into `DiffSuggestion` format
4. Return structured suggestions to the frontend

The LLM should analyze the transcript and return specific, actionable corrections with clear reasoning for each change. 