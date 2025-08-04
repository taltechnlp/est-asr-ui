import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { getSummaryGenerator } from "$lib/agents/summaryGenerator";

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    // Check authentication
    const session = await locals.auth();
    if (!session?.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = params;
    const summaryGenerator = getSummaryGenerator();
    const summary = await summaryGenerator.getSummary(fileId);

    if (!summary) {
      return json({ error: "Summary not found" }, { status: 404 });
    }

    return json(summary);
  } catch (error) {
    console.error("Get summary error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to get summary" },
      { status: 500 }
    );
  }
};