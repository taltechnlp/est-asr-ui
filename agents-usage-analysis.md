# Agents Folder Usage Analysis

## Currently Used Files ✅

### Core Agent Files (In Active Use)
1. **`coordinatingAgentSimple.ts`** 
   - Used by: `/api/transcript-analysis/segment/+server.ts`
   - Purpose: Main agent for segment analysis (text-based approach)
   - Status: **ACTIVELY USED**

2. **`coordinatingAgentPosition.ts`**
   - Used by: `/api/transcript-analysis/segment/+server.ts`, `/api/transcript-analysis/segment-position/+server.ts`
   - Purpose: Position-aware agent for server-side analysis
   - Status: **ACTIVELY USED**

3. **`coordinatingAgentClient.ts`**
   - Used by: `Tiptap.svelte`, `SegmentAnalysisButton.svelte`
   - Purpose: Client-side agent for applying suggestions
   - Status: **ACTIVELY USED**

4. **`coordinatingAgentPositionClient.ts`**
   - Used by: `Tiptap.svelte`, `SegmentControlPosition.svelte`
   - Purpose: Client-side position-aware agent
   - Status: **ACTIVELY USED**

### Supporting Files (In Active Use)
5. **`summaryGenerator.ts`**
   - Used by: `/api/transcript-summary/generate/+server.ts`
   - Purpose: Generates transcript summaries
   - Status: **ACTIVELY USED** (for summary generation)

6. **`transcriptAnalyzer.ts`**
   - Used by: `/api/transcript-analysis/+server.ts`
   - Purpose: Full transcript analysis
   - Status: **ACTIVELY USED** (for full analysis)

### Tools (In Active Use)
7. **`tools/asrNBestServerNode.ts`**
   - Used by: `coordinatingAgentSimple.ts`
   - Purpose: Node.js version of ASR tool with audio slicing
   - Status: **ACTIVELY USED**

8. **`tools/tiptapTransaction.ts`**
   - Used by: Client agents
   - Purpose: Direct TipTap editor manipulation
   - Status: **ACTIVELY USED**

9. **`tools/positionAwareTiptapTool.ts`**
   - Used by: Position-aware agents
   - Purpose: Position-based editor manipulation
   - Status: **ACTIVELY USED**

10. **`tools/webSearch.ts`**
    - Used by: Various agents
    - Purpose: Web search capabilities
    - Status: **ACTIVELY USED**

### Utilities (In Active Use)
11. **`utils/jsonParser.ts`**
    - Used by: `coordinatingAgentSimple.ts`
    - Purpose: Robust JSON parsing with LLM feedback
    - Status: **ACTIVELY USED**

12. **`prompts/transcriptAnalysis.ts`**
    - Used by: Various agents
    - Purpose: Prompt templates
    - Status: **ACTIVELY USED**

13. **`schemas/transcript.ts`**
    - Used by: Various agents
    - Purpose: TypeScript schemas
    - Status: **ACTIVELY USED**

## Potentially Unused Files ❌

### 1. **`coordinatingAgent.ts`** 🔴
   - **Status: LIKELY UNUSED**
   - Evidence: 
     - Uses LangGraph state management (StateGraph, END, START)
     - No imports found in current codebase
     - Replaced by `coordinatingAgentSimple.ts`
   - **Recommendation: Can be removed**

### 2. **`tools/asrNBestServer.ts`** 🔴
   - **Status: LIKELY UNUSED**
   - Evidence:
     - No imports found in codebase
     - Replaced by `asrNBestServerNode.ts` which has better error handling
   - **Recommendation: Can be removed**

### 3. **`tools/base.ts`** ✅
   - **Status: ACTIVELY USED**
   - Evidence: Used by `positionAwareTiptapTool.ts`, `tiptapTransaction.ts`, `webSearch.ts`
   - Purpose: Base class for LangChain tools
   - **Recommendation: Keep**

### 4. **`tools/index.ts`** ✅  
   - **Status: ACTIVELY USED**
   - Evidence: Imported by `coordinatingAgentSimple.ts`, `coordinatingAgentPosition.ts`, `transcriptAnalyzer.ts`, `coordinatingAgent.ts`
   - Purpose: Barrel export for tools
   - **Recommendation: Keep** (but can remove exports for unused tools)

## Summary

### Files Safe to Remove 🗑️:
1. **`coordinatingAgent.ts`** - Old LangGraph implementation, replaced by `coordinatingAgentSimple.ts`
2. **`tools/asrNBestServer.ts`** - Replaced by `asrNBestServerNode.ts` with better error handling

### Files to Keep (Actively Used) ✅:
- All `*Simple.ts`, `*Position*.ts`, and `*Client.ts` agents
- `summaryGenerator.ts` and `transcriptAnalyzer.ts`
- `tools/base.ts` - Base class for tools
- `tools/index.ts` - Barrel exports (can clean up unused exports)
- `tools/asrNBestServerNode.ts` - Current ASR implementation
- `tools/tiptapTransaction.ts` and `tools/positionAwareTiptapTool.ts`
- `tools/webSearch.ts`
- All utilities (`utils/jsonParser.ts`) and schemas

### Cleanup Recommendations:
1. Remove `coordinatingAgent.ts` - no longer needed
2. Remove `tools/asrNBestServer.ts` - superseded version
3. Update `tools/index.ts` to remove exports for deleted tools
4. Consider archiving old implementations in a separate folder if needed for reference

### Migration Notes:
The codebase has evolved from:
- LangGraph-based (`coordinatingAgent.ts`) → Direct implementation (`coordinatingAgentSimple.ts`)
- Single ASR tool → Separate Node.js version with better error handling
- Server-only agents → Separate client and server agents for better separation of concerns