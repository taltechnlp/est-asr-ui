import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getCoordinatingAgent } from "$lib/agents/coordinatingAgentSimple";
import { getPositionAwareAgent } from "$lib/agents/coordinatingAgentPosition";
import { extractSpeakerSegmentsWithPositions } from "$lib/services/positionAwareExtractor";
import { Editor } from "@tiptap/core";
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { prisma } from "$lib/db/client";
import { z } from "zod";
import type { SegmentWithTiming } from "$lib/utils/extractWordsFromEditor";
import { isSupportedLanguage } from "$lib/utils/language";

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
  uiLanguage: z.string().optional(),
  usePositions: z.boolean().optional().default(false),
  editorContent: z.any().optional(), // For position-based analysis
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
    const { fileId, segment, summaryId, audioFilePath, uiLanguage, usePositions, editorContent } = AnalyzeSegmentSchema.parse(body);
    
    // Validate UI language if provided
    if (uiLanguage && !isSupportedLanguage(uiLanguage)) {
      return json({ error: "Unsupported UI language" }, { status: 400 });
    }

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

    let result;
    
    if (usePositions && editorContent) {
      // Use position-based approach
      // Create a minimal editor for position extraction
      // We don't need all extensions, just the basic structure
      const editor = new Editor({
        extensions: [
          Document,
          Text,
        ],
        content: editorContent,
      });

      const segments = extractSpeakerSegmentsWithPositions(editor);
      const positionAgent = getPositionAwareAgent();
      positionAgent.setEditor(editor);
      
      result = await positionAgent.analyzeWithPositions({
        fileId,
        segments,
        summary,
        audioFilePath: actualAudioPath,
        uiLanguage,
      });
      
      editor.destroy();
    } else {
      // Use text-based approach (default)
      const agent = getCoordinatingAgent();
      result = await agent.analyzeSegment({
        fileId,
        segment: segment as SegmentWithTiming,
        summary,
        audioFilePath: actualAudioPath,
        uiLanguage,
      });
    }

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