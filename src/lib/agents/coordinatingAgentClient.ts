import { TipTapTransactionToolDirect } from './tools/tiptapTransaction';
import type { Editor } from '@tiptap/core';

export interface SegmentAnalysisRequest {
	fileId: string;
	segment: any;
	summary: any;
	audioFilePath: string;
}

export interface SegmentAnalysisResult {
	segmentIndex: number;
	analysis: string;
	suggestions: any[];
	nBestResults?: any;
	confidence: number;
}

/**
 * Client-side version of the coordinating agent that only handles TipTap transactions
 * Server-side tools (ASR, web search) are not available in this version
 */
export class CoordinatingAgentClient {
	private tiptapTool: TipTapTransactionToolDirect;

	constructor() {
		this.tiptapTool = new TipTapTransactionToolDirect();
	}

	setEditor(editor: Editor) {
		this.tiptapTool.setEditor(editor);
	}

	async applySuggestionManually(suggestion: any, segmentId?: string): Promise<{ success: boolean; error?: string }> {
		try {
			if (!suggestion.originalText || !suggestion.suggestedText) {
				return { success: false, error: 'Missing original or suggested text' };
			}

			const result = await this.tiptapTool.applyTransaction({
				originalText: suggestion.originalText,
				suggestedText: suggestion.suggestedText,
				segmentId: segmentId,
				changeType: suggestion.type || 'text_replacement',
				confidence: suggestion.confidence || 0.5,
				context: suggestion.text || suggestion.explanation || ''
			});

			const transactionResult = JSON.parse(result);
			return transactionResult;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Singleton instance for client-side usage
let coordinatingAgentClientInstance: CoordinatingAgentClient | null = null;

export function getCoordinatingAgentClient(): CoordinatingAgentClient {
	if (!coordinatingAgentClientInstance) {
		coordinatingAgentClientInstance = new CoordinatingAgentClient();
	}
	return coordinatingAgentClientInstance;
}