import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { TranscriptAnalyzer } from "$lib/agents/transcriptAnalyzer";
import { TranscriptAnalysisRequestSchema } from "$lib/agents/schemas/transcript";
import { OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { z } from "zod";

// Keep analyzer instances in memory to avoid recreating
const analyzers = new Map<string, TranscriptAnalyzer>();

function getAnalyzer(model: string): TranscriptAnalyzer {
  if (!analyzers.has(model)) {
    analyzers.set(model, new TranscriptAnalyzer(model));
  }
  return analyzers.get(model)!;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    const session = await locals.auth();
    if (!session?.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    
    // Extended schema with model selection
    const RequestSchema = TranscriptAnalysisRequestSchema.extend({
      model: z.enum([
        OPENROUTER_MODELS.CLAUDE_3_5_SONNET,
        OPENROUTER_MODELS.CLAUDE_3_5_HAIKU,
        OPENROUTER_MODELS.GPT_4O,
        OPENROUTER_MODELS.GPT_4O_MINI,
      ]).default(OPENROUTER_MODELS.CLAUDE_3_5_SONNET),
      stream: z.boolean().default(false),
    });

    const validatedRequest = RequestSchema.parse(body);
    const { model, stream, ...analysisRequest } = validatedRequest;

    // Get or create analyzer for the specified model
    const analyzer = getAnalyzer(model);

    if (stream) {
      // Set up Server-Sent Events for streaming
      const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      };

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial connection message
            controller.enqueue(`data: ${JSON.stringify({ type: "connected", model })}\n\n`);

            // Stream analysis results
            for await (const update of analyzer.analyzeStream(analysisRequest)) {
              const data = JSON.stringify(update);
              controller.enqueue(`data: ${data}\n\n`);
            }

            // Send completion message
            controller.enqueue(`data: ${JSON.stringify({ type: "complete" })}\n\n`);
            controller.close();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Analysis failed";
            controller.enqueue(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`);
            controller.close();
          }
        },
      });

      return new Response(stream, { headers });
    } else {
      // Non-streaming response
      const result = await analyzer.analyze(analysisRequest);
      return json(result);
    }
  } catch (error) {
    console.error("Transcript analysis error:", error);
    
    if (error instanceof z.ZodError) {
      return json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
};

// OPTIONS handler for CORS if needed
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};