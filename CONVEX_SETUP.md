# Convex Setup Guide

This project now uses Convex for database operations. Here's how to set it up:

## Prerequisites

1. Make sure you have the Convex CLI installed:
   ```bash
   npm install -g convex
   ```

2. Start the Convex development server:
   ```bash
   npx convex dev
   ```

## Environment Variables

Create a `.env` file in the root directory with:

```env
CONVEX_URL=http://localhost:3210
```

## Usage in Server-Side Code

### In SvelteKit Server Load Functions

```typescript
import type { ServerLoad } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

// Create a Convex client for server-side usage
const convex = new ConvexHttpClient(process.env.CONVEX_URL || "http://localhost:3210");

export const load = (async () => {
    // Query data from Convex
    const transcripts = await convex.query(api.transcripts.getAllTranscripts);
    
    return {
        transcripts
    };
}) satisfies ServerLoad;
```

### In SvelteKit Actions

```typescript
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.CONVEX_URL || "http://localhost:3210");

export const actions = {
    createTranscript: async ({ request }) => {
        const formData = await request.formData();
        const title = formData.get('title') as string;
        
        // Use Convex mutations
        const transcriptId = await convex.mutation(api.transcripts.createTranscript, {
            title,
            words: []
        });
        
        return { success: true, transcriptId };
    }
};
```

## Available API Functions

The following Convex functions are available:

### Queries
- `api.transcripts.getAllTranscripts` - Get all transcripts
- `api.transcripts.getTranscript` - Get a specific transcript by ID
- `api.transcripts.getWords` - Get words for a transcript
- `api.transcripts.getPendingSuggestions` - Get pending suggestions
- `api.transcripts.getSummary` - Get transcript summary

### Mutations
- `api.transcripts.createTranscript` - Create a new transcript
- `api.transcripts.updateWordText` - Update word text
- `api.transcripts.acceptSuggestion` - Accept a suggestion
- `api.transcripts.rejectSuggestion` - Reject a suggestion
- `api.transcripts.addSuggestion` - Add a new suggestion
- `api.transcripts.storeSummary` - Store a transcript summary

## Database Schema

The Convex schema includes:
- `transcripts` - Main transcript documents
- `words` - Individual words with timing and speaker info
- `agentSuggestions` - AI-generated suggestions for text improvements
- `transcriptSummaries` - AI-generated summaries of transcripts

## Development

1. Start the Convex dev server: `npx convex dev`
2. Start the SvelteKit dev server: `npm run dev`
3. The Convex functions will be automatically deployed to your development environment

## Production

For production, you'll need to:
1. Set up a Convex deployment
2. Update the `CONVEX_URL` environment variable to point to your production Convex deployment
3. Deploy your Convex functions: `npx convex deploy` 