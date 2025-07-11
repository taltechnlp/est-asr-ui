import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    _id: v.string(),
    title: v.string(),
    editorState: v.any(),
    status: v.union(
      v.literal("processing"),
      v.literal("reviewing"),
      v.literal("completed")
    ),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      _id: string;
      title: string;
      editorState: any;
      status: "processing" | "reviewing" | "completed";
    }
  ): Promise<Id<"documents">> => {
    return await ctx.db.insert("documents", {
      title: args.title,
      editorState: args.editorState,
      status: args.status,
    });
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (
    ctx: QueryCtx,
    args: { documentId: Id<"documents"> }
  ): Promise<Doc<"documents"> | null> => {
    return await ctx.db.get(args.documentId);
  },
}); 