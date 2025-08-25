import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
// import { getCoordinatingAgent } from "$lib/agents/coordinatingAgentSimple";
// import { TranscriptAnalysisRequestSchema } from "$lib/agents/schemas/transcript";
import { OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { z } from "zod";

// Keep analyzer instances in memory to avoid recreating
const analyzers = new Map<string, any>();

function getAnalyzer(model: string) {
  if (!analyzers.has(model)) {
    analyzers.set(model, getCoordinatingAgent(model));
  }
  return analyzers.get(model)!;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  // This endpoint is currently disabled - use /api/transcript-analysis/auto-analyze instead
  return json({ error: "This endpoint is not implemented. Use /api/transcript-analysis/auto-analyze instead." }, { status: 501 });
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