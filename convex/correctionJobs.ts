import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    originalText: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("error")
    ),
    tiptapNodePath: v.optional(v.any()),
    agentRunId: v.optional(v.string()),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      documentId: Id<"documents">;
      originalText: string;
      status: "pending" | "in_progress" | "completed" | "error";
      tiptapNodePath?: any;
      agentRunId?: string;
    }
  ): Promise<Id<"correctionJobs">> => {
    return await ctx.db.insert("correctionJobs", {
      documentId: args.documentId,
      originalText: args.originalText,
      status: args.status,
      tiptapNodePath: args.tiptapNodePath,
      agentRunId: args.agentRunId,
    });
  },
});

export const getByDocumentAndStatus = query({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("error")
    ),
  },
  handler: async (
    ctx: QueryCtx,
    args: { documentId: Id<"documents">; status: "pending" | "in_progress" | "completed" | "error" }
  ): Promise<Doc<"correctionJobs">[]> => {
    return await ctx.db
      .query("correctionJobs")
      .withIndex("by_document_and_status", (q) => 
        q.eq("documentId", args.documentId).eq("status", args.status)
      )
      .collect();
  },
}); 