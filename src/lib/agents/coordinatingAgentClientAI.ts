import { TipTapTransactionToolDirectAI } from './tools/tiptapTransactionAI';
import type { Editor } from '@tiptap/core';
import { robustJsonParse } from './utils/jsonParser';

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
 * AI-specific client-side version of the coordinating agent
 * Works with Word nodes instead of word marks
 */
export class CoordinatingAgentClientAI {
	private tiptapTool: TipTapTransactionToolDirectAI;

	constructor() {
		this.tiptapTool = new TipTapTransactionToolDirectAI();
	}

	setEditor(editor: Editor) {
		this.tiptapTool.setEditor(editor);
	}

	async applySuggestionManually(
		suggestion: any,
		segmentId?: string
	): Promise<{ success: boolean; error?: string }> {
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

			const parseResult = robustJsonParse(result);
			if (parseResult.success) {
				return parseResult.data;
			} else {
				console.error('Failed to parse transaction result:', parseResult.error);
				return {
					success: false,
					error: `JSON parsing failed: ${parseResult.error}`
				};
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}

// Singleton instance for client-side usage
let coordinatingAgentClientAIInstance: CoordinatingAgentClientAI | null = null;

export function getCoordinatingAgentClientAI(): CoordinatingAgentClientAI {
	if (!coordinatingAgentClientAIInstance) {
		coordinatingAgentClientAIInstance = new CoordinatingAgentClientAI();
	}
	return coordinatingAgentClientAIInstance;
}
