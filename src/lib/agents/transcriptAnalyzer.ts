import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createOpenRouterChat, OPENROUTER_MODELS } from "$lib/llm/openrouter";
import {
  GrammarCheckerTool,
  PunctuationFixerTool,
  SpeakerDiarizationTool,
  ConfidenceAnalyzerTool,
  ContextValidatorTool,
} from "./tools";
import {
  TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT,
  TRANSCRIPT_IMPROVEMENT_PROMPT,
} from "./prompts/transcriptAnalysis";
import type {
  TranscriptAnalysisRequest,
  TranscriptAnalysisResult,
  TranscriptAnalysisState,
  ImprovementSuggestion,
} from "./schemas/transcript";

// Define the state for our graph
interface GraphState {
  messages: BaseMessage[];
  request: TranscriptAnalysisRequest;
  suggestions: ImprovementSuggestion[];
  summary: string;
  error?: string;
}

export class TranscriptAnalyzer {
  private model;
  private tools;
  private toolNode;
  private graph;
  private compiledGraph;

  constructor(modelName: string = OPENROUTER_MODELS.CLAUDE_3_5_SONNET) {
    // Initialize model with tools
    this.tools = [
      new GrammarCheckerTool(),
      new PunctuationFixerTool(),
      new SpeakerDiarizationTool(),
      new ConfidenceAnalyzerTool(),
      new ContextValidatorTool(),
    ];

    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3, // Lower temperature for more consistent analysis
    }).bindTools(this.tools);

    this.toolNode = new ToolNode(this.tools);

    // Build the graph
    this.graph = new StateGraph<GraphState>({
      channels: {
        messages: {
          value: (x?: BaseMessage[], y?: BaseMessage[]) => (x ?? []).concat(y ?? []),
          default: () => [],
        },
        request: {
          value: (x?: TranscriptAnalysisRequest, y?: TranscriptAnalysisRequest) => y ?? x,
          default: () => ({} as TranscriptAnalysisRequest),
        },
        suggestions: {
          value: (x?: ImprovementSuggestion[], y?: ImprovementSuggestion[]) => (x ?? []).concat(y ?? []),
          default: () => [],
        },
        summary: {
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
    this.graph.addNode("analyze", this.analyzeNode.bind(this));
    this.graph.addNode("tools", this.toolNode);
    this.graph.addNode("synthesize", this.synthesizeNode.bind(this));

    // Add edges
    this.graph.addEdge(START, "analyze");
    this.graph.addConditionalEdges("analyze", (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if ("tool_calls" in lastMessage && lastMessage.tool_calls?.length) {
        return "tools";
      }
      return "synthesize";
    });
    this.graph.addEdge("tools", "synthesize");
    this.graph.addEdge("synthesize", END);

    // Compile the graph
    this.compiledGraph = this.graph.compile();
  }

  private async analyzeNode(state: GraphState): Promise<Partial<GraphState>> {
    const { request } = state;
    
    // Prepare the analysis prompt
    const segments = request.segments || [];
    const segmentInfo = segments.length > 0 
      ? `\n\nSegments (${segments.length} total):\n${segments.slice(0, 5).map(s => 
          `- [${s.speaker || 'Unknown'}] ${s.text.substring(0, 100)}...`
        ).join('\n')}`
      : "";

    const prompt = `${TRANSCRIPT_IMPROVEMENT_PROMPT}

Language: ${request.language}
Analysis Type: ${request.analysisType}

Transcript:
${request.transcript.substring(0, 2000)}${request.transcript.length > 2000 ? '...' : ''}
${segmentInfo}

Please analyze this transcript and use the available tools to identify issues and suggest improvements.`;

    const messages = [
      new HumanMessage({ content: TRANSCRIPT_ANALYSIS_SYSTEM_PROMPT }),
      new HumanMessage({ content: prompt }),
    ];

    const response = await this.model.invoke(messages);

    return {
      messages: [...state.messages, ...messages, response],
    };
  }

  private async synthesizeNode(state: GraphState): Promise<Partial<GraphState>> {
    const { messages, request } = state;
    
    // Extract tool results
    const toolResults: any[] = [];
    const suggestions: ImprovementSuggestion[] = [];
    
    messages.forEach(msg => {
      if (msg instanceof ToolMessage) {
        try {
          const result = JSON.parse(msg.content as string);
          toolResults.push(result);
          
          // Extract suggestions from tool results
          if (result.suggestions && Array.isArray(result.suggestions)) {
            suggestions.push(...result.suggestions);
          }
        } catch (e) {
          console.error("Failed to parse tool result:", e);
        }
      }
    });

    // Create synthesis prompt
    const synthesisPrompt = `Based on the analysis results, provide a comprehensive summary of the transcript quality and key improvements needed.

Tool Results Summary:
${toolResults.map(r => JSON.stringify(r, null, 2)).join('\n\n')}

Total suggestions found: ${suggestions.length}

Please provide:
1. An overall quality assessment (0-1 score)
2. A brief summary of main issues found
3. Priority recommendations for improvement

Format your response as a clear, actionable summary for the user.`;

    const synthesisMessages = [
      ...messages,
      new HumanMessage({ content: synthesisPrompt }),
    ];

    const summaryResponse = await createOpenRouterChat({
      modelName: OPENROUTER_MODELS.CLAUDE_3_5_HAIKU, // Use faster model for synthesis
      temperature: 0.5,
    }).invoke(synthesisMessages);

    // Calculate overall quality score based on suggestions
    const severityWeights = { low: 0.1, medium: 0.3, high: 0.5 };
    const qualityDeduction = suggestions.reduce((acc, s) => 
      acc + (severityWeights[s.severity] * s.confidence), 0
    ) / Math.max(suggestions.length, 1);
    const overallQuality = Math.max(0, 1 - qualityDeduction * 0.1);

    return {
      messages: [...synthesisMessages, summaryResponse],
      suggestions: suggestions,
      summary: summaryResponse.content as string,
    };
  }

  async analyze(request: TranscriptAnalysisRequest): Promise<TranscriptAnalysisResult> {
    try {
      const initialState: GraphState = {
        messages: [],
        request,
        suggestions: [],
        summary: "",
      };

      const result = await this.compiledGraph.invoke(initialState);

      // Extract word and speaker counts from request
      const totalWords = request.transcript.split(/\s+/).length;
      const totalSpeakers = request.speakers?.length || 
        (request.segments?.map(s => s.speaker).filter((v, i, a) => a.indexOf(v) === i).length || 1);

      // Calculate overall quality
      const severityWeights = { low: 0.1, medium: 0.3, high: 0.5 };
      const qualityDeduction = result.suggestions.reduce((acc: number, s: ImprovementSuggestion) => 
        acc + (severityWeights[s.severity] * s.confidence), 0
      ) / Math.max(result.suggestions.length, 1);
      const overallQuality = Math.max(0, 1 - qualityDeduction * 0.1);

      return {
        suggestions: result.suggestions,
        summary: result.summary,
        overallQuality,
        metadata: {
          totalWords,
          totalSpeakers,
          duration: undefined, // Can be added if provided
          language: request.language,
        },
      };
    } catch (error) {
      console.error("Transcript analysis error:", error);
      throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream analysis results for real-time feedback
   */
  async *analyzeStream(request: TranscriptAnalysisRequest) {
    const initialState: GraphState = {
      messages: [],
      request,
      suggestions: [],
      summary: "",
    };

    const stream = await this.compiledGraph.stream(initialState);
    
    for await (const update of stream) {
      if (update.tools) {
        // Yield tool results as they come
        yield { type: "tool_result", data: update.tools };
      } else if (update.synthesize) {
        // Yield final synthesis
        yield { type: "synthesis", data: update.synthesize };
      }
    }
  }
}