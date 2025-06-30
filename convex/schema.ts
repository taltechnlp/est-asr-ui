import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transcripts: defineTable({
    title: v.string(),
    customId: v.optional(v.string()), // For custom string IDs like "demo-transcript-1"
    status: v.union(
      v.literal("processing"),
      v.literal("reviewing"),
      v.literal("completed")
    ),
  }).index("by_custom_id", ["customId"]),

  words: defineTable({
    transcriptId: v.id("transcripts"),
    text: v.string(),
    start: v.number(),
    end: v.number(),
    speakerTag: v.string(),
    wordIndex: v.number(), // For maintaining order
  }).index("by_transcript", ["transcriptId", "wordIndex"]), // Index for efficient querying

  agentSuggestions: defineTable({
    transcriptId: v.string(), // Using string ID for flexibility
    originalText: v.string(), // The original text to be replaced
    suggestedText: v.string(), // The suggested replacement text
    reason: v.string(), // Explanation for the suggestion
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    createdAt: v.number(), // Timestamp for ordering
  }).index("by_transcript_and_status", ["transcriptId", "status"]),

  transcriptSummaries: defineTable({
    transcriptId: v.string(), // Using string ID for flexibility  
    summary: v.string(), // The AI-generated summary text
    wordCount: v.number(), // Word count of the original transcript
    generatedAt: v.number(), // Timestamp when summary was generated
  }).index("by_transcript", ["transcriptId"]),
}); 