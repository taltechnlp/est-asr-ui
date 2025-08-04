import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

export abstract class TranscriptAnalysisTool extends DynamicStructuredTool {
  constructor(
    name: string,
    description: string,
    schema: z.ZodObject<any>,
    func: (input: any) => Promise<string>
  ) {
    super({
      name,
      description,
      schema,
      func,
    });
  }
}