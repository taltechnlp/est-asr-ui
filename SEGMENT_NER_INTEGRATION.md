# Segment Extraction and NER Integration Guide

This guide explains how to integrate Named Entity Recognition (NER) with segment extraction for ASR transcript refinement.

## Overview

The system provides a comprehensive pipeline for analyzing ASR transcripts:
1. **Segment Extraction**: Break transcripts into logical segments
2. **NER Analysis**: Identify named entities and potential issues
3. **LLM Analysis**: Use OpenRouter for intelligent error detection and correction suggestions
4. **Transcript Refinement**: Apply corrections and generate final output

## API Endpoints

### NER Analysis
```bash
POST /api/tools/ner
Content-Type: application/json

{
  "text": "Tallinna Ülikooli rektor Tiit Land",
  "language": "et"
}
```

### Transcript Refinement
```bash
POST /api/agent/transcript-refinement
Content-Type: application/json

{
  "fileId": "file_123",
  "words": [...],
  "speakers": [...],
  "content": {...}
}
```

## Usage Examples

### Basic NER Analysis
```javascript
import { NERTool } from '$lib/agent/nerTool';

const nerTool = new NERTool();
const result = await nerTool.call(JSON.stringify({
  text: "Tallinna Ülikooli rektor Tiit Land",
  language: "et"
}));

console.log(result);
// Output: Formatted NER analysis with entities, confidence levels, and issues
```

### Full Transcript Refinement
```javascript
import { TranscriptRefinementAgent } from '$lib/agent/transcriptRefinementAgent';

const agent = new TranscriptRefinementAgent(false); // Use real OpenRouter
const result = await agent.refineTranscript(
  "file_123",
  words,
  speakers,
  transcriptContent
);

console.log(result);
// Output: Complete analysis with corrections, confidence scores, and LLM suggestions
```

### Individual Segment Analysis
```javascript
const analysis = await agent.analyzeSegment(
  "Tallinna Ülikooli rektor Tiit Land.",
  "segment_1",
  0,
  5000,
  "Speaker 1"
);

console.log(analysis);
// Output: Detailed segment analysis with NER results and LLM feedback
```

## Configuration

### Environment Variables
```bash
# Required for real LLM integration
OPENROUTER_API_KEY=your_api_key_here

# Optional: NER service configuration
TARTUNLP_API_URL=https://api.tartunlp.ai/bert/ner/v1
```

### Agent Configuration
```javascript
// Use real OpenRouter (requires API key)
const agent = new TranscriptRefinementAgent(false);

// Use mock mode (for testing without API key)
const agent = new TranscriptRefinementAgent(true);
```

## Response Formats

### NER Response
```javascript
{
  entities: [
    {
      text: "Tallinna Ülikooli",
      label: "ORG",
      start: 0,
      end: 17,
      confidence: "high",
      potentialIssues: [],
      suggestions: [],
      context: {
        before: "",
        after: " rektor Tiit Land",
        fullContext: "Tallinna Ülikooli rektor Tiit Land"
      },
      metadata: {
        entityType: "ORG",
        length: 17,
        wordCount: 2,
        hasSpecialChars: false,
        isAllCaps: false,
        isAllLower: false
      }
    }
  ],
  summary: {
    totalEntities: 3,
    entityTypes: { "ORG": 1, "PER": 2 },
    entitiesWithIssues: 0,
    highConfidenceEntities: 3,
    lowConfidenceEntities: 0,
    averageEntityLength: 8.3
  },
  fallback: false
}
```

### Transcript Refinement Response
```javascript
{
  fileId: "file_123",
  totalSegments: 2,
  analyzedSegments: 2,
  segmentsWithIssues: 0,
  segments: [
    {
      segmentId: "segment_0",
      text: "Tallinna Ülikooli rektor Tiit Land.",
      confidence: "medium",
      issues: [],
      corrections: [],
      nerAnalysis: { /* NER results */ },
      llmSuggestions: ["Detailed LLM analysis..."]
    }
  ],
  summary: {
    totalCorrections: 0,
    highPriorityIssues: 0,
    entityIssues: 0,
    confidenceIssues: 0
  },
  processingTime: 42370
}
```

## Error Handling

The system includes comprehensive error handling:

1. **NER Service Unavailable**: Falls back to mock entities
2. **OpenRouter API Errors**: Returns mock analysis with error details
3. **Invalid Input**: Validates input and provides clear error messages
4. **Network Timeouts**: Configurable timeouts with retry logic

## Testing

### Run All Tests
```bash
bun run scripts/test_transcript_refinement.js
bun run scripts/test_segment_ner_integration.js
```

### Test Individual Components
```bash
# Test NER only
curl -X POST http://localhost:5173/api/tools/ner \
  -H "Content-Type: application/json" \
  -d '{"text": "Tallinna Ülikooli rektor Tiit Land", "language": "et"}'

# Test transcript refinement
curl -X POST http://localhost:5173/api/agent/transcript-refinement \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test", "words": [], "speakers": [], "content": {}}'
```

## Performance Considerations

- **Processing Time**: ~20-40 seconds per segment (includes real LLM calls)
- **Rate Limiting**: Built-in delays between API calls
- **Caching**: Consider implementing result caching for repeated analysis
- **Batch Processing**: Process multiple segments sequentially to avoid overwhelming APIs

## Future Enhancements

- **Web Search Integration**: Fact-check entities against web sources
- **User Feedback Loop**: Learn from user corrections
- **Advanced Error Detection**: More sophisticated ASR error patterns
- **Multi-language Support**: Extend beyond Estonian
- **Real-time Processing**: Stream processing for live transcripts 