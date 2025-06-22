# Segment Extraction System for LLM Analysis

This document describes the comprehensive system for extracting text segments from ASR transcripts and sending them to LLM services for analysis and correction.

## Overview

Instead of sending entire documents to LLMs (which is inefficient and expensive), this system extracts specific text segments and sends only the relevant portions for analysis. This approach:

- **Reduces costs** by sending smaller payloads
- **Improves performance** by processing focused segments
- **Enables targeted analysis** by analyzing specific parts of the transcript
- **Maintains context** by including surrounding information when needed

## Architecture

### Core Components

1. **SegmentExtractor** - Extracts text segments from ProseMirror documents
2. **SegmentSerializer** - Converts segments to various formats for transmission
3. **SegmentAPIClient** - Handles communication with LLM services
4. **API Endpoints** - Receive and process segment analysis requests

### Data Flow

```
Editor → SegmentExtractor → SegmentSerializer → API Client → LLM Service → Response → Diff Commands → Editor
```

## Segment Extraction Strategies

### 1. Selection-Based Extraction
Extract only the currently selected text in the editor.

```typescript
const segments = segmentExtractor.extractSelection();
```

**Use Case**: User selects specific text they want analyzed.

### 2. Paragraph-Based Extraction
Extract segments based on paragraph boundaries.

```typescript
const segments = segmentExtractor.extract({
  strategy: ExtractionStrategy.PARAGRAPH,
  minLength: 10,
  maxLength: 1000
});
```

**Use Case**: Analyze entire document by natural text boundaries.

### 3. Speaker-Based Extraction
Extract segments based on speaker boundaries.

```typescript
const segments = segmentExtractor.extract({
  strategy: ExtractionStrategy.SPEAKER_SEGMENT,
  includeSpeakerInfo: true
});
```

**Use Case**: Analyze each speaker's contributions separately.

### 4. Sliding Window Extraction
Extract overlapping segments using a sliding window approach.

```typescript
const segments = segmentExtractor.extract({
  strategy: ExtractionStrategy.SLIDING_WINDOW,
  windowSize: 500,
  overlap: 100
});
```

**Use Case**: Process long documents in manageable chunks with context overlap.

### 5. Confidence-Based Extraction
Extract segments based on confidence scores.

```typescript
const segments = segmentExtractor.extract({
  strategy: ExtractionStrategy.CONFIDENCE_BASED,
  confidenceThreshold: 0.7
});
```

**Use Case**: Focus analysis on low-confidence segments that likely need correction.

### 6. Manual Range Extraction
Extract segments from specific document positions.

```typescript
const segments = segmentExtractor.extract({
  strategy: ExtractionStrategy.MANUAL_RANGE,
  start: 100,
  end: 500
});
```

**Use Case**: Analyze specific portions of the document.

## Segment Data Structure

Each extracted segment contains:

```typescript
interface TextSegment {
  id: string;                    // Unique identifier
  text: string;                  // The actual text content
  start: number;                 // Start position in document
  end: number;                   // End position in document
  speaker?: {                    // Speaker information
    id: string;
    name: string;
  };
  metadata: {                    // Rich metadata
    wordCount: number;
    characterCount: number;
    hasTimestamps: boolean;
    marks: string[];             // ProseMirror marks
    confidence?: number;         // ASR confidence score
  };
  context?: {                    // Optional context
    previousSegment?: string;
    nextSegment?: string;
  };
}
```

## Serialization Formats

### 1. JSON Format
Full structured data with all metadata.

```typescript
const jsonData = SegmentSerializer.toJSON(segments);
```

**Output**:
```json
[
  {
    "id": "paragraph_100_200",
    "text": "Hello world",
    "start": 100,
    "end": 200,
    "speaker": {
      "id": "speaker1",
      "name": "John Doe"
    },
    "metadata": {
      "wordCount": 2,
      "characterCount": 11,
      "hasTimestamps": true,
      "marks": ["word", "pronHighlight"],
      "confidence": 0.85
    }
  }
]
```

### 2. Plain Text Format
Simple text with speaker labels.

```typescript
const plainText = SegmentSerializer.toPlainText(segments);
```

**Output**:
```
[John Doe]: Hello world

[Jane Smith]: How are you today?
```

### 3. Structured Format for LLM
Optimized format for LLM processing.

```typescript
const structured = SegmentSerializer.toStructuredFormat(segments);
```

**Output**:
```json
{
  "segments": [
    {
      "id": "paragraph_100_200",
      "text": "Hello world",
      "speaker": "John Doe",
      "metadata": {
        "wordCount": 2,
        "characterCount": 11,
        "hasTimestamps": true,
        "confidence": 0.85
      }
    }
  ],
  "summary": {
    "totalSegments": 1,
    "totalWords": 2,
    "totalCharacters": 11,
    "speakers": ["John Doe"]
  }
}
```

## API Integration

### Request Format

```typescript
interface SegmentRequest {
  segments: TextSegment[];
  requestId: string;
  fileId: string;
  analysisType: 'spelling' | 'grammar' | 'punctuation' | 'context' | 'speaker' | 'comprehensive';
  language: string;
  options?: {
    includeContext?: boolean;
    maxSegmentLength?: number;
    minConfidence?: number;
    preserveTimestamps?: boolean;
  };
}
```

### Response Format

```typescript
interface SegmentResponse {
  requestId: string;
  segments: {
    segmentId: string;
    suggestions: Array<{
      type: 'replace' | 'insert' | 'delete' | 'speaker_change' | 'punctuation' | 'capitalization' | 'spacing' | 'grammar' | 'context' | 'translation';
      start: number;
      end: number;
      originalText?: string;
      newText?: string;
      reason: string;
      confidence: number;
    }>;
    overallConfidence: number;
    summary: string;
  }[];
}
```

## Usage Examples

### Basic Segment Extraction

```typescript
// Initialize extractor
const extractor = new SegmentExtractor(editor);

// Extract selected text
const selectedSegments = extractor.extractSelection();

// Extract all paragraphs
const allSegments = extractor.extract({
  strategy: ExtractionStrategy.PARAGRAPH,
  minLength: 10,
  maxLength: 1000
});

// Add context to segments
const segmentsWithContext = extractor.addContext(allSegments, 100);
```

### Sending Segments for Analysis

```typescript
// Initialize API client
const apiClient = new SegmentAPIClient();

// Send segments for comprehensive analysis
const response = await apiClient.analyzeSegmentsByType(
  segments,
  'comprehensive',
  fileId,
  'et',
  {
    includeContext: true,
    maxSegmentLength: 1000
  }
);

// Process response
response.segments.forEach(segmentResponse => {
  console.log(`Segment ${segmentResponse.segmentId}: ${segmentResponse.summary}`);
  segmentResponse.suggestions.forEach(suggestion => {
    console.log(`- ${suggestion.type}: ${suggestion.reason}`);
  });
});
```

### Integration with Diff System

```typescript
// Convert segment response to diff commands
const diffCommands: DiffCommand[] = [];
response.segments.forEach(segmentResponse => {
  segmentResponse.suggestions.forEach(suggestion => {
    diffCommands.push({
      id: `${segmentResponse.segmentId}_${suggestion.start}_${suggestion.end}`,
      type: suggestion.type,
      start: suggestion.start,
      end: suggestion.end,
      originalText: suggestion.originalText,
      newText: suggestion.newText,
      reason: suggestion.reason,
      confidence: suggestion.confidence
    });
  });
});

// Apply diff visualization
createDiffMarks(editor, diffCommands);
```

## LLM Integration Guidelines

### 1. Segment Size Optimization
- **Small segments** (10-100 words): Good for precise corrections
- **Medium segments** (100-500 words): Good for context-aware corrections
- **Large segments** (500+ words): Use sliding window approach

### 2. Context Inclusion
- Include previous/next segments for better context
- Preserve speaker information for multi-speaker transcripts
- Include timestamps when relevant for audio alignment

### 3. Analysis Types
- **Spelling**: Focus on word-level corrections
- **Grammar**: Sentence-level corrections
- **Punctuation**: Mark-level corrections
- **Context**: Multi-segment analysis
- **Speaker**: Speaker identification and attribution
- **Comprehensive**: All of the above

### 4. Confidence Handling
- Use confidence scores to prioritize low-confidence segments
- Filter out high-confidence segments to reduce processing
- Include confidence in LLM prompts for better analysis

## Performance Considerations

### 1. Batch Processing
- Process multiple segments in a single request
- Use appropriate batch sizes (10-50 segments per request)
- Implement request queuing for large documents

### 2. Caching
- Cache segment extraction results
- Cache LLM responses for repeated analysis
- Implement incremental updates

### 3. Rate Limiting
- Respect LLM API rate limits
- Implement exponential backoff for retries
- Queue requests during high load

## Error Handling

### 1. Network Errors
```typescript
try {
  const response = await apiClient.analyzeSegments(request);
} catch (error) {
  if (error.name === 'NetworkError') {
    // Retry with exponential backoff
  } else if (error.status === 429) {
    // Rate limited, wait and retry
  } else {
    // Log error and show user message
  }
}
```

### 2. Invalid Segments
```typescript
// Validate segments before sending
const validSegments = segments.filter(segment => {
  return segment.text.trim().length > 0 && 
         segment.metadata.wordCount > 0;
});
```

### 3. Partial Failures
```typescript
// Handle partial responses
response.segments.forEach(segmentResponse => {
  if (segmentResponse.suggestions.length === 0) {
    console.log(`No suggestions for segment ${segmentResponse.segmentId}`);
  }
});
```

## Future Enhancements

### 1. Real-time Analysis
- Stream segments as user types
- Provide live suggestions
- Implement progressive enhancement

### 2. Advanced Context
- Include audio waveform data
- Add visual context (slides, images)
- Include document metadata

### 3. Multi-modal Analysis
- Combine text and audio analysis
- Include visual context
- Support for multiple languages

### 4. Intelligent Segmentation
- AI-powered segment boundary detection
- Context-aware segment sizing
- Dynamic confidence thresholds

## Integration with LangChain

To integrate with your LangChain pipeline:

1. **Replace the mock API** in `/api/segment-analysis/+server.ts`
2. **Send segments to your LLM chain**:
   ```typescript
   const chain = new LLMChain({
     llm: yourLLM,
     prompt: yourPrompt
   });
   
   const result = await chain.call({
     segments: structuredSegments,
     analysisType: request.analysisType,
     language: request.language
   });
   ```
3. **Parse LLM response** into the expected format
4. **Return structured suggestions** to the frontend

The segment extraction system provides a robust foundation for efficient LLM-powered transcript correction while maintaining the rich context and metadata needed for accurate analysis. 