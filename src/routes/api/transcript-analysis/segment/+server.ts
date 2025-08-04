import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getCoordinatingAgent } from "$lib/agents/coordinatingAgentSimple";
import { prisma } from "$lib/db/client";
import { z } from "zod";
import type { SegmentWithTiming } from "$lib/utils/extractWordsFromEditor";

const AnalyzeSegmentSchema = z.object({
  fileId: z.string(),
  segment: z.object({
    index: z.number(),
    startTime: z.number(),
    endTime: z.number(),
    startWord: z.number(),
    endWord: z.number(),
    text: z.string(),
    speakerTag: z.string(),
    words: z.array(z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
      speakerTag: z.string(),
    })),
  }),
  summaryId: z.string(),
  audioFilePath: z.string(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    const session = await locals.auth();
    if (!session?.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const { fileId, segment, summaryId, audioFilePath } = AnalyzeSegmentSchema.parse(body);

    // Verify file ownership
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { 
        uploader: true,
        path: true,
      },
    });

    if (!file) {
      return json({ error: "File not found" }, { status: 404 });
    }

    if (file.uploader !== session.user.id) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get summary
    const summary = await prisma.transcriptSummary.findUnique({
      where: { id: summaryId },
    });

    if (!summary || summary.fileId !== fileId) {
      return json({ error: "Summary not found" }, { status: 404 });
    }

    // Use the actual file path from database if audioFilePath is not provided correctly
    const actualAudioPath = audioFilePath || file.path;

    // Analyze segment using coordinating agent
    const agent = getCoordinatingAgent();
    const result = await agent.analyzeSegment({
      fileId,
      segment: segment as SegmentWithTiming,
      summary,
      audioFilePath: actualAudioPath,
    });

    // Get the saved analysis segment
    const analysisSegment = await prisma.analysisSegment.findUnique({
      where: {
        fileId_segmentIndex: {
          fileId,
          segmentIndex: segment.index,
        },
      },
    });

    return json({
      ...result,
      analysisSegment,
    });
  } catch (error) {
    console.error("Analyze segment error:", error);
    
    if (error instanceof z.ZodError) {
      return json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return json(
      { error: error instanceof Error ? error.message : "Failed to analyze segment" },
      { status: 500 }
    );
  }
};