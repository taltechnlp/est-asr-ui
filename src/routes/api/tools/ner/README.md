# NER (Named Entity Recognition) API

This API endpoint provides Named Entity Recognition capabilities for the ASR transcript refinement agent. It identifies entities in text and analyzes them for potential ASR errors.

## Endpoints

### POST `/api/tools/ner`
Main NER processing endpoint.

**Request Body:**
```json
{
  "text": "Your text to analyze",
  "language": "et"  // Optional, defaults to "et" (Estonian)
}
```

**Response:**
```json
{
  "entities": [
    {
      "text": "Tallinna Ülikooli",
      "label": "ORG",
      "start": 0,
      "end": 17,
      "potentialIssues": [],
      "suggestions": [],
      "confidence": "high",
      "context": {
        "before": "",
        "after": " rektor Tiit Land kohtus Tartu Ülikooli professoriga",
        "fullContext": "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professoriga"
      },
      "metadata": {
        "entityType": "ORG",
        "length": 17,
        "wordCount": 2,
        "hasSpecialChars": false,
        "isAllCaps": false,
        "isAllLower": false
      }
    }
  ],
  "text": "Original text",
  "language": "et",
  "processing_time": 1234567890,
  "summary": {
    "totalEntities": 3,
    "entityTypes": {
      "ORG": 2,
      "PER": 1
    },
    "entitiesWithIssues": 0,
    "highConfidenceEntities": 3,
    "lowConfidenceEntities": 0,
    "averageEntityLength": 13.3
  },
  "fallback": false
}
```

### GET `/api/tools/ner`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "tartunlp",
  "url": "https://api.tartunlp.ai/bert/ner/v1"
}
```

### GET `/api/tools/ner/test`
Test endpoint with sample Estonian text.

**Response:**
```json
{
  "success": true,
  "sampleText": "Tallinna Ülikooli rektor Tiit Land ja Tartu Ülikooli professor...",
  "nerResult": { /* Full NER analysis result */ },
  "message": "NER test completed successfully"
}
```

## Configuration

### Environment Variables

- `NER_SERVICE_URL`: URL for the local NER service in production (defaults to `http://localhost:8000/ner`)
- `NODE_ENV`: Determines which service to use (`development` uses TartuNLP, `production` uses local service)

### Service Configuration

**Development:**
- Uses TartuNLP API: `https://api.tartunlp.ai/bert/ner/v1`
- No authentication required
- 30-second timeout
- Handles TartuNLP's specific response format (B-ORG/I-ORG token format)

**Production:**
- Uses local Dockerized service
- Configurable via `NER_SERVICE_URL` environment variable
- 30-second timeout

## TartuNLP API Integration

The system integrates with the TartuNLP API which returns entities in BIO (Beginning-Inside-Outside) format:

**TartuNLP Response Format:**
```json
{
  "result": [
    [
      {"word": "Tallinna", "ner": "B-ORG"},
      {"word": "Ülikooli", "ner": "I-ORG"},
      {"word": "rektor", "ner": "O"},
      {"word": "Tiit", "ner": "B-PER"},
      {"word": "Land", "ner": "B-PER"}
    ]
  ]
}
```

**Conversion to Standard Format:**
The `parseTartuNLPResponse()` function converts this to the standard entity format:
- Combines B-ORG + I-ORG tokens into single entities
- Calculates proper start/end positions
- Handles multi-word entities correctly
- Supports all entity types (ORG, PER, LOC, etc.)

## Entity Analysis Features

The API performs several analyses on detected entities to help identify potential ASR errors:

### 1. Potential Issues Detection
- **Mixed Case**: Unusual capitalization patterns
- **Repeated Characters**: Common ASR error (e.g., "Tallllinn")
- **Unusual Character Patterns**: Long sequences of vowels or consonants
- **Boundary Issues**: Entities spanning sentence boundaries

### 2. Context Analysis
- Provides surrounding text context (100 characters before/after by default)
- Helps the agent understand entity placement and usage

### 3. Metadata Enrichment
- Entity type, length, word count
- Special character detection
- Case pattern analysis

### 4. Confidence Scoring
- **High**: No detected issues
- **Medium**: 1-2 minor issues
- **Low**: 3+ issues or major problems

## Fallback System

The API includes a robust fallback system:

1. **Primary**: Attempts to call the configured NER service (TartuNLP in dev, local in prod)
2. **Fallback**: If the primary service fails, uses `generateFallbackNERResults()` for basic entity detection
3. **Error Handling**: Graceful degradation with informative error messages

The fallback system ensures the API remains functional even when external services are unavailable.

## Integration with AI Agent

The agent can use this API to:

1. **Identify Problematic Entities**: Focus on entities with `confidence: "low"` or `potentialIssues.length > 0`
2. **Context-Aware Corrections**: Use the `context` information for better correction suggestions
3. **Entity Type Prioritization**: Prioritize corrections based on entity types (e.g., proper nouns vs. organizations)
4. **Batch Processing**: Use the `summary` statistics to understand the overall quality of the transcript

### Example Agent Usage

```typescript
// In your LangChain agent
const nerResponse = await fetch('/api/tools/ner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: transcriptText, language: 'et' })
});

const nerData = await nerResponse.json();

// Focus on problematic entities
const problematicEntities = nerData.entities.filter(
  entity => entity.confidence === 'low' || entity.potentialIssues.length > 0
);

// Generate corrections based on context
for (const entity of problematicEntities) {
  const correction = await generateCorrection(entity.text, entity.context, entity.metadata);
  // Apply correction logic...
}
```

## Error Handling

The API includes comprehensive error handling:

- **400**: Invalid request (missing text, wrong format)
- **500**: Internal server error
- **503**: NER service unavailable (health check)

All errors include descriptive messages and relevant details for debugging.

## Testing

Use the test endpoint to verify functionality:

```bash
curl http://localhost:5173/api/tools/ner/test
```

This will process sample Estonian text and return the full NER analysis.

For direct testing of the main endpoint:

```bash
curl -X POST http://localhost:5173/api/tools/ner \
  -H "Content-Type: application/json" \
  -d '{"text": "Tallinna Ülikooli rektor Tiit Land", "language": "et"}'
``` 