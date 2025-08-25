import { z } from 'zod';
import { TranscriptAnalysisTool } from './base';
import { findAndCreateDiff } from '$lib/services/transcriptTextReplaceDiff';
import type { Editor } from '@tiptap/core';

// Schema for the tool input
const TipTapTransactionSchema = z.object({
	originalText: z.string().describe('The original text to find and replace'),
	suggestedText: z.string().describe('The new text to replace it with'),
	segmentId: z.string().optional().describe('Optional segment ID to limit search scope'),
	changeType: z
		.enum(['text_replacement', 'speaker_change', 'punctuation', 'grammar'])
		.default('text_replacement')
		.describe('Type of change being made'),
	confidence: z.number().min(0).max(1).describe('Confidence level of the suggested change'),
	context: z.string().optional().describe('Additional context about the change')
});

export type TipTapTransactionInput = z.infer<typeof TipTapTransactionSchema>;

export interface TipTapTransactionResult {
	success: boolean;
	error?: string;
	matchCount?: number;
	appliedAt?: number;
	transactionId?: string;
	requiresApproval?: boolean;
}

export class TipTapTransactionTool extends TranscriptAnalysisTool {
	private editor: Editor | null = null;

	constructor() {
		const bindedApplyChange = (input: TipTapTransactionInput) => this.applyChange(input);

		super(
			'tiptap_transaction',
			`Apply text changes to the TipTap editor using ProseMirror transactions.
      
This tool can:
- Locate text within the editor document
- Create diff nodes to show proposed changes
- Handle different types of changes (text replacement, speaker changes, etc.)
- Always create inline diff nodes for user approval - never directly replaces text
- Return errors if multiple matches are found (requires more specific text)

The tool creates diff nodes that show both original and suggested text, allowing users to review and approve/reject changes.`,
			TipTapTransactionSchema,
			bindedApplyChange
		);
	}

	setEditor(editor: Editor) {
		this.editor = editor;
	}

	private async applyChange(input: TipTapTransactionInput): Promise<string> {
		if (!this.editor) {
			const result: TipTapTransactionResult = {
				success: false,
				error: 'TipTap editor not available'
			};
			return JSON.stringify(result);
		}

		const { originalText, suggestedText, segmentId, changeType, confidence, context } = input;

		try {
			// Always create diff nodes for user review - never directly replace text
			console.log('Creating diff node for text suggestion...');
			const diffResult = findAndCreateDiff(this.editor, originalText, suggestedText, {
				caseSensitive: false,
				changeType,
				confidence,
				context
			});

			if (diffResult.success) {
				const successResult: TipTapTransactionResult = {
					success: true,
					matchCount: diffResult.matchCount || 1,
					appliedAt: diffResult.appliedAt,
					transactionId: diffResult.diffId || `diff_${Date.now()}`,
					requiresApproval: true
				};
				console.log(`✅ Created diff node: ${successResult.transactionId}`);
				return JSON.stringify(successResult);
			}

			// Return the error from diff creation
			const errorResult: TipTapTransactionResult = {
				success: false,
				error: diffResult.error || 'Failed to create diff node',
				matchCount: diffResult.matchCount || 0
			};
			return JSON.stringify(errorResult);
		} catch (error) {
			const result: TipTapTransactionResult = {
				success: false,
				error: `Failed to apply change: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
			return JSON.stringify(result);
		}
	}
}

export function createTipTapTransactionTool(): TipTapTransactionTool {
	return new TipTapTransactionTool();
}

// Add a direct call method that bypasses the protected _call
export class TipTapTransactionToolDirect {
	private tool: TipTapTransactionTool;

	constructor() {
		this.tool = new TipTapTransactionTool();
	}

	setEditor(editor: Editor) {
		this.tool.setEditor(editor);
	}

	async applyTransaction(input: TipTapTransactionInput): Promise<string> {
		return this.tool['applyChange'](input);
	}
}
