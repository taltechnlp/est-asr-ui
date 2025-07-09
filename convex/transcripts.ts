import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// QUERIES (for reading data)

export const getTranscript = query({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    // First try to get by Convex ID (if it looks like one)
    if (args.transcriptId.length > 20) {
      try {
        return await ctx.db.get(args.transcriptId as any);
      } catch {
        // Fall through to custom ID lookup
      }
    }
    
    // Otherwise, look up by custom ID using the index
    return await ctx.db
      .query("transcripts")
      .withIndex("by_custom_id", (q) => q.eq("customId", args.transcriptId))
      .first();
  },
});

export const getWords = query({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    // First resolve the transcript to get its actual ID
    const transcript = await ctx.runQuery("transcripts:getTranscript" as any, {
      transcriptId: args.transcriptId,
    });
    
    if (!transcript) {
      return [];
    }
    
    return await ctx.db
      .query("words")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", transcript._id))
      .order("asc") // Sort by wordIndex ascending
      .collect();
  },
});

export const getPendingSuggestions = query({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSuggestions")
      .withIndex("by_transcript_and_status", (q) =>
        q.eq("transcriptId", args.transcriptId).eq("status", "pending")
      )
      .order("desc") // Most recent first
      .collect();
  },
});

export const getAllTranscripts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transcripts").collect();
  },
});

export const getSummary = query({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("transcriptSummaries")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .first();
    
    return summary;
  },
});

// MUTATIONS (for writing data)

export const createTranscript = mutation({
  args: { 
    title: v.string(),
    customId: v.optional(v.string()),
    words: v.array(v.object({
      text: v.string(),
      start: v.number(),
      end: v.number(),
      speakerTag: v.string(),
    }))
  },
  handler: async (ctx, args) => {
    // Create the transcript
    const transcriptId = await ctx.db.insert("transcripts", {
      title: args.title,
      customId: args.customId,
      status: "processing",
    });

    // Insert all words with proper indexing
    for (let i = 0; i < args.words.length; i++) {
      await ctx.db.insert("words", {
        transcriptId,
        text: args.words[i].text,
        start: args.words[i].start,
        end: args.words[i].end,
        speakerTag: args.words[i].speakerTag,
        wordIndex: i,
      });
    }

    return transcriptId;
  },
});

export const updateWordText = mutation({
  args: { 
    wordId: v.id("words"), 
    newText: v.string() 
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.wordId, { text: args.newText });
  },
});

export const acceptSuggestion = mutation({
  args: { suggestionId: v.id("agentSuggestions") },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    // Update the suggestion status
    await ctx.db.patch(args.suggestionId, { status: "accepted" });

    // Note: Text replacement is handled in the frontend for this implementation
    // In a more sophisticated setup, you might want to update a stored transcript text here

    return suggestion;
  },
});

export const rejectSuggestion = mutation({
  args: { suggestionId: v.id("agentSuggestions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.suggestionId, { status: "rejected" });
  },
});

export const addSuggestion = mutation({
  args: {
    transcriptId: v.string(),
    originalText: v.string(),
    suggestedText: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentSuggestions", {
      transcriptId: args.transcriptId,
      originalText: args.originalText,
      suggestedText: args.suggestedText,
      reason: args.reason,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const storeSummary = mutation({
  args: {
    transcriptId: v.string(),
    summary: v.string(),
    wordCount: v.number(),
    generatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if a summary already exists for this transcript
    const existingSummary = await ctx.db
      .query("transcriptSummaries")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .first();

    const summaryData = {
      transcriptId: args.transcriptId,
      summary: args.summary,
      wordCount: args.wordCount,
      generatedAt: args.generatedAt || Date.now(),
    };

    if (existingSummary) {
      // Update existing summary
      await ctx.db.patch(existingSummary._id, summaryData);
      return existingSummary._id;
    } else {
      // Create new summary
      return await ctx.db.insert("transcriptSummaries", summaryData);
    }
  },
});

// ACTIONS (for side effects like calling external services)

export const runAgent = action({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    // This action will be called from the UI
    // It should invoke the Agno agent externally
    
    // For now, we'll simulate the agent by creating some mock suggestions
    // In the real implementation, this would make an HTTP request to your deployed agent
    
    const transcript = await ctx.runQuery(api.transcripts.getTranscript, {
      transcriptId: args.transcriptId,
    });
    
    const words = await ctx.runQuery(api.transcripts.getWords, {
      transcriptId: args.transcriptId,
    });
    
    if (!transcript || words.length === 0) {
      throw new Error("Transcript or words not found");
    }

    // Simulate agent processing - create a mock suggestion
    // Find words that might need correction (simple heuristic: short words)
    const potentialErrors = words.filter(word => word.text.length <= 2);
    
    for (const word of potentialErrors.slice(0, 3)) { // Limit to first 3 for demo
      await ctx.runMutation(api.transcripts.addSuggestion, {
        transcriptId: args.transcriptId,
        originalWordIds: [word._id],
        suggestedText: word.text.toUpperCase(), // Simple transformation for demo
        reason: "Demo: Short word capitalization",
      });
    }

    // Update transcript status
    await ctx.runMutation(api.transcripts.updateTranscriptStatus, {
      transcriptId: args.transcriptId,
      status: "reviewing",
    });

    return { success: true, suggestionsCreated: potentialErrors.length };
  },
});

export const updateTranscriptStatus = mutation({
  args: { 
    transcriptId: v.string(), 
    status: v.union(
      v.literal("processing"),
      v.literal("reviewing"),
      v.literal("completed")
    )
  },
  handler: async (ctx, args) => {
    // First resolve the transcript to get its actual ID
    const transcript = await ctx.runQuery("transcripts:getTranscript" as any, {
      transcriptId: args.transcriptId,
    });
    
    if (!transcript) {
      throw new Error("Transcript not found");
    }
    
    await ctx.db.patch(transcript._id, { status: args.status });
  },
});

export const updateTranscript = mutation({
  args: { 
    transcriptId: v.id("transcripts"), 
    title: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("reviewing"),
      v.literal("completed")
    )
  },
  handler: async (ctx, args) => {
    console.log(`🔄 [CONVEX] Updating transcript:`, {
      transcriptId: args.transcriptId,
      title: args.title,
      status: args.status,
      timestamp: new Date().toISOString()
    });
    
    await ctx.db.patch(args.transcriptId, { 
      title: args.title,
      status: args.status 
    });
    
    console.log(`✅ [CONVEX] Successfully updated transcript: ${args.transcriptId}`);
  },
});

export const clearWordsForTranscript = mutation({
  args: { transcriptId: v.id("transcripts") },
  handler: async (ctx, args) => {
    console.log(`🗑️ [CONVEX] Clearing words for transcript: ${args.transcriptId}`);
    
    // Get all words for this transcript
    const words = await ctx.db
      .query("words")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .collect();
    
    console.log(`📊 [CONVEX] Found ${words.length} words to delete`);
    
    // Delete all words
    for (const word of words) {
      await ctx.db.delete(word._id);
    }
    
    console.log(`✅ [CONVEX] Successfully deleted ${words.length} words from transcript: ${args.transcriptId}`);
    
    return { deletedCount: words.length };
  },
});

export const addWord = mutation({
  args: {
    transcriptId: v.id("transcripts"),
    text: v.string(),
    start: v.number(),
    end: v.number(),
    speakerTag: v.string(),
    wordIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const wordId = await ctx.db.insert("words", {
      transcriptId: args.transcriptId,
      text: args.text,
      start: args.start,
      end: args.end,
      speakerTag: args.speakerTag,
      wordIndex: args.wordIndex,
    });
    
    // Log every 100th word to avoid spam
    if (args.wordIndex % 100 === 0) {
      console.log(`📝 [CONVEX] Added word ${args.wordIndex}: "${args.text}" to transcript: ${args.transcriptId}`);
    }
    
    return wordId;
  },
});

export const deleteSummary = mutation({
  args: { transcriptId: v.string() },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("transcriptSummaries")
      .withIndex("by_transcript", (q) => q.eq("transcriptId", args.transcriptId))
      .first();
    
    if (summary) {
      await ctx.db.delete(summary._id);
      return { deleted: true };
    }
    
    return { deleted: false };
  },
});

export const getAllSummaries = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transcriptSummaries").collect();
  },
}); 