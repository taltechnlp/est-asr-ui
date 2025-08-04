# Transcript Analysis Agent System

This document describes the AI-powered transcript analysis system integrated into the EST-ASR-UI application.

## Overview

The transcript analysis agent system provides intelligent analysis of transcriptions using LLMs (Large Language Models). It consists of several key components:

1. **Summary Generation** - Generates comprehensive summaries of entire transcripts
2. **Segment Analysis** - Analyzes transcripts in 200-word segments with context
3. **ASR N-best Integration** - Retrieves alternative transcriptions for low-confidence segments
4. **Web Search** - Searches for context about unfamiliar terms or concepts

## Architecture

### Core Components

#### 1. Summary Generator (`/src/lib/agents/summaryGenerator.ts`)
- Uses OpenRouter API to access various LLMs (Claude, GPT-4, etc.)
- Generates summaries with key topics, speaker count, and language detection
- Stores summaries in database for reuse

#### 2. Coordinating Agent (`/src/lib/agents/coordinatingAgent.ts`)
- Built with LangGraph for state management
- Orchestrates the analysis workflow
- Uses summary as context for segment analysis
- Integrates tools (ASR N-best, web search)

#### 3. Tools

##### ASR N-best Tool (`/src/lib/agents/tools/asrNBest.ts`)
- Slices audio files using FFmpeg
- Sends segments to ASR API
- Returns alternative transcriptions

##### Web Search Tool (`/src/lib/agents/tools/webSearch.ts`)
- Searches for information about specific terms
- Language-aware search (Estonian, Finnish, English)
- Falls back gracefully if search fails

### UI Components

#### Summary Accordion (`/src/lib/components/transcript-summary/SummaryAccordion.svelte`)
- Collapsible summary display
- Shows key topics as tags
- Regenerate functionality

#### Segment Control (`/src/lib/components/transcript-analysis/SegmentControl.svelte`)
- Navigate through transcript segments
- Manual analysis trigger
- Display results and alternatives
- Progress tracking

### API Endpoints

- `GET /api/transcript-summary/[fileId]` - Retrieve existing summary
- `POST /api/transcript-summary/generate` - Generate new summary
- `GET /api/transcript-analysis/segments/[fileId]` - Get analyzed segments
- `POST /api/transcript-analysis/segment` - Analyze specific segment

## Setup

### Environment Variables

Add to your `.env` file:
```
OPENROUTER_API_KEY=your-openrouter-api-key
```

Get your API key from [OpenRouter](https://openrouter.ai/).

### Database Migration

Run the migration to create new tables:
```bash
npx prisma migrate deploy
```

## Usage

### In the Transcript Editor

The TranscriptChat component now includes three tabs:

1. **Summary** - Generate and view transcript summary
2. **Segment Analysis** - Analyze transcript segment by segment
3. **Legacy** - Original full transcript analysis

### Workflow

1. Open a transcript in the editor
2. Click the chat bubble to open the analysis panel
3. Go to the Summary tab and generate a summary
4. Switch to Segment Analysis tab
5. Navigate through segments and analyze each one
6. The agent will use the summary as context
7. Low-confidence segments can trigger ASR N-best retrieval

## Development

### Adding New Tools

1. Create tool in `/src/lib/agents/tools/`
2. Extend `TranscriptAnalysisTool` base class
3. Add to coordinating agent's tool list
4. Update tool exports in `index.ts`

### Modifying Analysis Prompts

Edit prompts in:
- `/src/lib/agents/summaryGenerator.ts` - Summary generation prompt
- `/src/lib/agents/coordinatingAgent.ts` - Segment analysis prompt

### Testing

Visit `/test-agent` to see a demo of the components without needing a real transcript.

## Limitations

- ASR N-best requires audio file access
- Web search uses basic DuckDuckGo scraping (consider upgrading to proper API)
- Analysis quality depends on LLM model selected
- FFmpeg must be installed for audio slicing

## Future Improvements

- Batch segment analysis
- Automatic low-confidence detection
- Integration with editor for direct text replacement
- Streaming analysis results
- Custom tool development
- Fine-tuned models for Estonian/Finnish