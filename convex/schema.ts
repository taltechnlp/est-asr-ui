import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Store the entire TipTap document state
  documents: defineTable({
    title: v.string(),
    // Store the full TipTap JSON document here
    editorState: v.any(), 
    status: v.union(
      v.literal("processing"),
      v.literal("reviewing"),
      v.literal("completed")
    ),
  }),

  // Store summaries for context
  documentSummaries: defineTable({
    documentId: v.id("documents"),
    summary: v.string(),
    generatedAt: v.number(),
  }).index("by_document", ["documentId"]),

  // Manage segments for the AI agent
  correctionJobs: defineTable({
    documentId: v.id("documents"),
    // The original TipTap JSON for the segment
    originalText: v.string(),
    // The corrected TipTap JSON from the agent
    correctedText: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("error")
    ),
    // Store the path to the node in the TipTap document
    tiptapNodePath: v.optional(v.any()),
    agentRunId: v.optional(v.string()), // To track the agent's work
  }).index("by_document_and_status", ["documentId", "status"]),

  // Transcripts table for storing transcript metadata
  transcripts: defineTable({
    title: v.string(),
    customId: v.optional(v.string()),
    status: v.union(
      v.literal("processing"),
      v.literal("reviewing"),
      v.literal("completed")
    ),
  }).index("by_custom_id", ["customId"]),

  // Words table for storing individual words with timing
  words: defineTable({
    transcriptId: v.id("transcripts"),
    text: v.string(),
    start: v.number(),
    end: v.number(),
    speakerTag: v.string(),
    wordIndex: v.number(),
  }).index("by_transcript", ["transcriptId"]),

  // Agent suggestions for transcript corrections
  agentSuggestions: defineTable({
    transcriptId: v.string(),
    originalText: v.string(),
    suggestedText: v.string(),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    createdAt: v.number(),
  }).index("by_transcript_and_status", ["transcriptId", "status"]),

  // Transcript summaries
  transcriptSummaries: defineTable({
    transcriptId: v.string(),
    summary: v.string(),
    wordCount: v.number(),
    generatedAt: v.number(),
  }).index("by_transcript", ["transcriptId"]),
});