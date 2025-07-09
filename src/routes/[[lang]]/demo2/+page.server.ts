import type { ServerLoad } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

// Create a Convex client for server-side usage
const convex = new ConvexHttpClient(process.env.CONVEX_URL || "http://localhost:3210");

export const load = (async () => {
    // Example: Fetch all transcripts from Convex
    const transcripts = await convex.query(api.transcripts.getAllTranscripts);
    
    // Example: Get a specific transcript (you can modify this as needed)
    // const demoTranscript = await convex.query(api.transcripts.getTranscript, { 
    //     transcriptId: "demo-transcript-1" 
    // });
    
    return {
        transcripts,
        // demoTranscript,
    };
}) satisfies ServerLoad;

// Example of how to use mutations in server-side code
// You can create actions or other server-side functions that use Convex mutations
export const actions = {
    createTranscript: async ({ request }) => {
        const formData = await request.formData();
        const title = formData.get('title') as string;
        const customId = formData.get('customId') as string;
        
        // Example: Create a new transcript using Convex mutation
        const transcriptId = await convex.mutation(api.transcripts.createTranscript, {
            title,
            customId,
            words: [] // Add words as needed
        });
        
        return { success: true, transcriptId };
    },
    
    addSuggestion: async ({ request }) => {
        const formData = await request.formData();
        const transcriptId = formData.get('transcriptId') as string;
        const originalText = formData.get('originalText') as string;
        const suggestedText = formData.get('suggestedText') as string;
        const reason = formData.get('reason') as string;
        
        // Example: Add a suggestion using Convex mutation
        const suggestionId = await convex.mutation(api.transcripts.addSuggestion, {
            transcriptId,
            originalText,
            suggestedText,
            reason
        });
        
        return { success: true, suggestionId };
    }
};