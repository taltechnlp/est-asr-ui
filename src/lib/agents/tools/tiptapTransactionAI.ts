import { z } from 'zod';
import { TranscriptAnalysisTool } from './base';
import { findAndCreateDiff } from '$lib/services/transcriptTextReplaceDiffAI'; // Use AI-specific version
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

export class TipTapTransactionToolAI extends TranscriptAnalysisTool {
	private editor: Editor | null = null;

	constructor() {
		const bindedApplyChange = (input: TipTapTransactionInput) => this.applyChange(input);

		super(
			'tiptap_transaction_ai',
			`Apply text changes to the TipTap editor using Word nodes.
      
This AI-specific tool:
- Works with Word nodes instead of word marks
- Locates text within Word node structure
- Creates diff nodes for proposed changes
- Handles different types of changes (text replacement, speaker changes, etc.)
- Always creates inline diff nodes for user approval - never directly replaces text
- Returns errors if multiple matches are found (requires more specific text)

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
			console.log('Creating diff node for text suggestion (Word node version)...');
			const diffResult = findAndCreateDiff(this.editor, originalText, suggestedText, {
				caseSensitive: false,
				changeType,
				confidence,
				context
			});

			if (diffResult.success) {
				const successResult: TipTapTransactionResult = {
					success: true,
					matchCount: 1,
					appliedAt: diffResult.position,
					transactionId: diffResult.diffId || `diff_${Date.now()}`,
					requiresApproval: true
				};
				console.log(`✅ Created diff node in Word node document: ${successResult.transactionId}`);
				return JSON.stringify(successResult);
			}

			// Return the error from diff creation
			const errorResult: TipTapTransactionResult = {
				success: false,
				error: diffResult.error || 'Failed to create diff node',
				matchCount: 0
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

export function createTipTapTransactionToolAI(): TipTapTransactionToolAI {
	return new TipTapTransactionToolAI();
}

// Direct call version for client-side usage
export class TipTapTransactionToolDirectAI {
	private tool: TipTapTransactionToolAI;

	constructor() {
		this.tool = new TipTapTransactionToolAI();
	}

	setEditor(editor: Editor) {
		this.tool.setEditor(editor);
	}

	async applyTransaction(input: TipTapTransactionInput): Promise<string> {
		return this.tool['applyChange'](input);
	}
}
