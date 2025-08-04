import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createOpenRouterChat, OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { createASRNBestServerTool, createWebSearchTool } from "./tools";
import type { TranscriptSummary, AnalysisSegment } from "@prisma/client";
import { prisma } from "$lib/db/client";
import type { SegmentWithTiming } from "$lib/utils/extractWordsFromEditor";

// State for the coordinating agent
interface CoordinatingAgentState {
  messages: BaseMessage[];
  fileId: string;
  summary: TranscriptSummary | null;
  currentSegment: SegmentWithTiming | null;
  segmentAnalysis: string;
  suggestions: any[];
  nBestResults: any | null;
  audioFilePath: string;
  error?: string;
}

export interface SegmentAnalysisRequest {
  fileId: string;
  segment: SegmentWithTiming;
  summary: TranscriptSummary;
  audioFilePath: string;
}

export interface SegmentAnalysisResult {
  segmentIndex: number;
  analysis: string;
  suggestions: any[];
  nBestResults?: any;
  confidence: number;
}

const SEGMENT_ANALYSIS_PROMPT = `You are an expert transcript analyst specializing in Estonian and Finnish languages.

Context from full transcript summary:
{summary}

Current segment to analyze (segment {segmentIndex} of {totalSegments}):
Speaker: {speaker}
Text: {text}
Duration: {duration} seconds

Your task:
1. Analyze this segment for quality, accuracy, and coherence
2. Consider the context from the full transcript summary
3. Identify potential transcription errors or unclear passages
4. If confidence is low or text seems incorrect, use the asr_nbest tool to get alternatives
5. Use web_search tool to verify unfamiliar terms or proper nouns
6. Provide specific improvement suggestions

Focus on:
- Grammar and language correctness
- Consistency with the overall transcript context
- Proper nouns and technical terms accuracy
- Speaker attribution accuracy
- Punctuation and formatting

Provide a detailed analysis with actionable suggestions.`;

export class CoordinatingAgent {
  private model;
  private tools;
  private toolNode;
  private graph;
  private compiledGraph;

  constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
    // Initialize tools
    this.tools = [
      createASRNBestServerTool(),
      createWebSearchTool(),
    ];

    // Initialize model with tools
    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3,
      maxTokens: 2000,
    }).bindTools(this.tools);

    this.toolNode = new ToolNode(this.tools);

    // Build the state graph
    this.graph = new StateGraph<CoordinatingAgentState>({
      channels: {
        messages: {
          value: (x?: BaseMessage[], y?: BaseMessage[]) => (x ?? []).concat(y ?? []),
          default: () => [],
        },
        fileId: {
          value: (x?: string, y?: string) => y ?? x ?? "",
          default: () => "",
        },
        summary: {
          value: (x?: TranscriptSummary | null, y?: TranscriptSummary | null) => y ?? x,
          default: () => null,
        },
        currentSegment: {
          value: (x?: SegmentWithTiming | null, y?: SegmentWithTiming | null) => y ?? x,
          default: () => null,
        },
        segmentAnalysis: {
          value: (x?: string, y?: string) => y ?? x ?? "",
          default: () => "",
        },
        suggestions: {
          value: (x?: any[], y?: any[]) => y ?? x ?? [],
          default: () => [],
        },
        nBestResults: {
          value: (x?: any, y?: any) => y ?? x,
          default: () => null,
        },
        audioFilePath: {
          value: (x?: string, y?: string) => y ?? x ?? "",
          default: () => "",
        },
        error: {
          value: (x?: string, y?: string) => y ?? x,
          default: () => undefined,
        },
      },
    });

    // Add nodes
    this.graph.addNode("analyze_segment", this.analyzeSegmentNode.bind(this));
    this.graph.addNode("tools", this.toolNode);
    this.graph.addNode("synthesize", this.synthesizeNode.bind(this));

    // Add edges
    this.graph.addEdge(START, "analyze_segment");
    
    // Conditional edge from analyze to either tools or synthesize
    this.graph.addConditionalEdges("analyze_segment", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if ("tool_calls" in lastMessage && lastMessage.tool_calls?.length) {
        return "tools";
      }
      return "synthesize";
    });
    
    this.graph.addEdge("tools", "analyze_segment"); // Go back to analyze after tools
    this.graph.addEdge("synthesize", END);

    // Compile the graph
    this.compiledGraph = this.graph.compile();
  }

  private async analyzeSegmentNode(state: CoordinatingAgentState): Promise<Partial<CoordinatingAgentState>> {
    const { summary, currentSegment, audioFilePath, messages } = state;
    
    if (!currentSegment || !summary) {
      return {
        error: "Missing segment or summary data",
      };
    }

    // Check if this is a continuation after tool use
    const hasToolResults = messages.some(msg => msg instanceof ToolMessage);
    if (hasToolResults) {
      // Continue with synthesis after tool results
      return {};
    }

    // Build the analysis prompt
    const prompt = SEGMENT_ANALYSIS_PROMPT
      .replace("{summary}", summary.summary)
      .replace("{segmentIndex}", (currentSegment.index + 1).toString())
      .replace("{totalSegments}", "TBD") // This would need to be passed in
      .replace("{speaker}", currentSegment.speakerTag)
      .replace("{text}", currentSegment.text)
      .replace("{duration}", (currentSegment.endTime - currentSegment.startTime).toFixed(2));

    const analysisMessage = new HumanMessage({ content: prompt });
    
    // Add context about available tools
    const toolContext = new HumanMessage({
      content: `Available tools:
- asr_nbest: Get alternative transcriptions if confidence is low. Provide audioFilePath="${audioFilePath}", startTime=${currentSegment.startTime}, endTime=${currentSegment.endTime}
- web_search: Search for information about unfamiliar terms

Analyze the segment and use tools if needed.`,
    });

    const response = await this.model.invoke([analysisMessage, toolContext]);

    return {
      messages: [analysisMessage, toolContext, response],
    };
  }

  private async synthesizeNode(state: CoordinatingAgentState): Promise<Partial<CoordinatingAgentState>> {
    const { messages, currentSegment } = state;
    
    // Extract analysis and tool results
    const toolResults: any[] = [];
    let nBestResults = null;
    
    messages.forEach(msg => {
      if (msg instanceof ToolMessage) {
        try {
          const result = JSON.parse(msg.content as string);
          toolResults.push(result);
          
          // Check if this is ASR N-best result
          if (result.alternatives) {
            nBestResults = result;
          }
        } catch (e) {
          console.error("Failed to parse tool result:", e);
        }
      }
    });

    // Create final analysis
    const synthesisPrompt = `Based on your analysis and any tool results, provide:

1. A concise analysis of the segment quality
2. Confidence score (0-1) for the transcription accuracy
3. Specific improvement suggestions in JSON format

Tool Results:
${toolResults.map(r => JSON.stringify(r, null, 2)).join('\n\n')}

Format your response as:
ANALYSIS: <your analysis>
CONFIDENCE: <0-1 score>
SUGGESTIONS: <JSON array of suggestions>`;

    const synthesisMessage = new HumanMessage({ content: synthesisPrompt });
    const finalResponse = await this.model.invoke([...messages, synthesisMessage]);
    
    // Parse the response
    const responseText = finalResponse.content as string;
    const analysisMatch = responseText.match(/ANALYSIS:\s*([\s\S]*?)(?=CONFIDENCE:|$)/);
    const confidenceMatch = responseText.match(/CONFIDENCE:\s*([\d.]+)/);
    const suggestionsMatch = responseText.match(/SUGGESTIONS:\s*(\[[\s\S]*\])/);
    
    const analysis = analysisMatch?.[1]?.trim() || responseText;
    const confidence = parseFloat(confidenceMatch?.[1] || "0.5");
    const suggestions = suggestionsMatch?.[1] ? JSON.parse(suggestionsMatch[1]) : [];

    return {
      segmentAnalysis: analysis,
      suggestions,
      nBestResults,
      messages: [...messages, synthesisMessage, finalResponse],
    };
  }

  async analyzeSegment(request: SegmentAnalysisRequest): Promise<SegmentAnalysisResult> {
    try {
      const initialState: CoordinatingAgentState = {
        messages: [],
        fileId: request.fileId,
        summary: request.summary,
        currentSegment: request.segment,
        segmentAnalysis: "",
        suggestions: [],
        nBestResults: null,
        audioFilePath: request.audioFilePath,
      };

      const result = await this.compiledGraph.invoke(initialState);

      // Calculate confidence based on analysis
      const hasLowConfidenceIndicators = result.segmentAnalysis.toLowerCase().includes("unclear") ||
                                        result.segmentAnalysis.toLowerCase().includes("error") ||
                                        result.segmentAnalysis.toLowerCase().includes("incorrect");
      
      const confidence = hasLowConfidenceIndicators ? 0.6 : 0.85;

      // Save to database
      await prisma.analysisSegment.upsert({
        where: {
          fileId_segmentIndex: {
            fileId: request.fileId,
            segmentIndex: request.segment.index,
          },
        },
        create: {
          fileId: request.fileId,
          segmentIndex: request.segment.index,
          startTime: request.segment.startTime,
          endTime: request.segment.endTime,
          startWord: request.segment.startWord,
          endWord: request.segment.endWord,
          originalText: request.segment.text,
          analysis: result.segmentAnalysis,
          suggestions: result.suggestions,
          nBestResults: result.nBestResults,
          status: "analyzed",
        },
        update: {
          analysis: result.segmentAnalysis,
          suggestions: result.suggestions,
          nBestResults: result.nBestResults,
          status: "analyzed",
        },
      });

      return {
        segmentIndex: request.segment.index,
        analysis: result.segmentAnalysis,
        suggestions: result.suggestions,
        nBestResults: result.nBestResults,
        confidence,
      };
    } catch (error) {
      console.error("Segment analysis error:", error);
      throw new Error(`Failed to analyze segment: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getAnalyzedSegments(fileId: string): Promise<AnalysisSegment[]> {
    return prisma.analysisSegment.findMany({
      where: { fileId },
      orderBy: { segmentIndex: "asc" },
    });
  }
}

// Singleton instance
let coordinatingAgentInstance: CoordinatingAgent | null = null;

export function getCoordinatingAgent(modelName?: string): CoordinatingAgent {
  if (!coordinatingAgentInstance || modelName) {
    coordinatingAgentInstance = new CoordinatingAgent(modelName);
  }
  return coordinatingAgentInstance;
}