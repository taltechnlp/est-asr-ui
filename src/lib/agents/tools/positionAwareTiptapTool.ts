import { z } from 'zod';
import { TranscriptAnalysisTool } from './base';
import type { Editor } from '@tiptap/core';
import {
	type PositionAwareSegment,
	llmResponseToAbsolute,
	validatePositionContent,
	type LLMPositionResponse
} from '$lib/services/positionAwareExtractor';
import {
	getPositionMapper,
	PositionRecovery,
	TransactionReconciler
} from '$lib/services/positionMapper';

// Schema for position-based tool input
const PositionAwareTipTapSchema = z.object({
	segmentId: z.string().describe('The ID of the segment containing the text'),
	startChar: z.number().describe('Character offset from segment start'),
	endChar: z.number().describe('Character offset from segment start'),
	originalText: z.string().describe('The original text to verify'),
	suggestedText: z.string().describe('The new text to replace it with'),
	changeType: z
		.enum(['text_replacement', 'speaker_change', 'punctuation', 'grammar'])
		.default('text_replacement')
		.describe('Type of change being made'),
	confidence: z.number().min(0).max(1).describe('Confidence level of the suggested change'),
	context: z.string().optional().describe('Additional context about the change')
});

export type PositionAwareTipTapInput = z.infer<typeof PositionAwareTipTapSchema>;

export interface PositionAwareTipTapResult {
	success: boolean;
	error?: string;
	diffId?: string;
	appliedAt?: number;
	mappingConfidence?: number;
	fallbackUsed?: boolean;
}

export class PositionAwareTipTapTool extends TranscriptAnalysisTool {
	private editor: Editor | null = null;
	private segments: PositionAwareSegment[] = [];
	private reconciler = new TransactionReconciler();

	constructor() {
		const bindedApplyChange = (input: PositionAwareTipTapInput) =>
			this.applyPositionBasedChange(input);

		super(
			'position_aware_tiptap',
			`Apply text changes using absolute positions in the TipTap editor.
      
This tool:
- Uses absolute document positions for unambiguous placement
- Validates text content at specified positions
- Handles concurrent edits through position mapping
- Falls back to text search only when positions are invalid
- Always creates diff nodes for user review
- Provides high confidence in change placement

The tool expects position information relative to segments sent to the LLM.`,
			PositionAwareTipTapSchema,
			bindedApplyChange
		);
	}

	setEditor(editor: Editor) {
		this.editor = editor;
	}

	setSegments(segments: PositionAwareSegment[]) {
		this.segments = segments;
	}

	private async applyPositionBasedChange(input: PositionAwareTipTapInput): Promise<string> {
		if (!this.editor) {
			const result: PositionAwareTipTapResult = {
				success: false,
				error: 'TipTap editor not available'
			};
			return JSON.stringify(result);
		}

		const {
			segmentId,
			startChar,
			endChar,
			originalText,
			suggestedText,
			changeType,
			confidence,
			context
		} = input;

		try {
			// Convert LLM response to absolute positions
			const llmResponse: LLMPositionResponse = {
				segmentId,
				startChar,
				endChar,
				originalText,
				suggestedText,
				confidence,
				type: changeType
			};

			const absolute = llmResponseToAbsolute(llmResponse, this.segments);

			if (!absolute) {
				// Segment not found
				const result: PositionAwareTipTapResult = {
					success: false,
					error: `Segment ${segmentId} not found`,
					fallbackUsed: false
				};
				return JSON.stringify(result);
			}

			// Get position mapper for handling concurrent edits
			const mapper = getPositionMapper(this.editor);

			// Map positions through any concurrent edits
			const mappedRange = mapper.mapRange(absolute.from, absolute.to);

			let finalFrom = absolute.from;
			let finalTo = absolute.to;
			let mappingConfidence = 1;
			let fallbackUsed = false;

			if (mappedRange.valid) {
				// Use mapped positions
				finalFrom = mappedRange.from.mapped;
				finalTo = mappedRange.to.mapped;
				mappingConfidence = Math.min(mappedRange.from.confidence, mappedRange.to.confidence);

				// Validate content at mapped positions
				const isValid = validatePositionContent(
					this.editor.state.doc,
					finalFrom,
					finalTo,
					originalText
				);

				if (!isValid) {
					console.warn('Position content validation failed, attempting recovery...');

					// Try to recover using text context
					const recovered = PositionRecovery.recoverByTextContext(
						this.editor.state.doc,
						originalText,
						finalFrom,
						200
					);

					if (recovered) {
						finalFrom = recovered.from;
						finalTo = recovered.to;
						mappingConfidence = 0.7;
						fallbackUsed = true;
						console.log('Successfully recovered position using text context');
					} else {
						// Last resort: fall back to text search
						console.warn('Position recovery failed, falling back to text search');
						return this.fallbackToTextSearch(
							originalText,
							suggestedText,
							changeType,
							confidence,
							context
						);
					}
				}
			} else {
				// Positions invalid after mapping, try recovery
				console.warn('Position mapping invalid, attempting recovery...');

				const recovered = PositionRecovery.recoverByTextContext(
					this.editor.state.doc,
					originalText,
					mappedRange.from.mapped,
					300
				);

				if (recovered) {
					finalFrom = recovered.from;
					finalTo = recovered.to;
					mappingConfidence = 0.6;
					fallbackUsed = true;
				} else {
					// Fall back to text search
					return this.fallbackToTextSearch(
						originalText,
						suggestedText,
						changeType,
						confidence,
						context
					);
				}
			}

			// Create diff node at the determined position
			const diffId = `diff_pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			const success = this.editor
				.chain()
				.focus()
				.command(({ tr, state }) => {
					// Validate schema has diff node
					if (!state.schema.nodes.diff) {
						console.error('Diff node type not registered in schema');
						return false;
					}

					// Final validation before applying
					const currentText = state.doc.textBetween(finalFrom, finalTo, ' ');
					const matches = currentText.toLowerCase().trim() === originalText.toLowerCase().trim();

					if (!matches && !fallbackUsed) {
						console.error(
							`Text mismatch at position: expected "${originalText}", found "${currentText}"`
						);
						return false;
					}

					// Create diff node
					const diffNode = state.schema.nodes.diff.create({
						id: diffId,
						originalText: currentText, // Use actual text at position
						suggestedText,
						changeType,
						confidence: confidence * mappingConfidence, // Adjust confidence based on mapping
						context: context || '',
						from: finalFrom,
						to: finalTo
					});

					// Replace range with diff node
					tr.replaceWith(finalFrom, finalTo, diffNode);

					console.log(`Created position-based diff node ${diffId} at ${finalFrom}-${finalTo}`);
					console.log(`  Mapping confidence: ${mappingConfidence}`);
					console.log(`  Fallback used: ${fallbackUsed}`);

					return true;
				})
				.run();

			if (success) {
				// Store for potential reconciliation later
				this.reconciler.storePendingSuggestion(
					diffId,
					{
						from: finalFrom,
						to: finalTo,
						originalText,
						suggestedText
					},
					mapper.getVersion()
				);

				const result: PositionAwareTipTapResult = {
					success: true,
					diffId,
					appliedAt: finalFrom,
					mappingConfidence,
					fallbackUsed
				};
				return JSON.stringify(result);
			} else {
				const result: PositionAwareTipTapResult = {
					success: false,
					error: 'Failed to create diff node at specified position',
					fallbackUsed
				};
				return JSON.stringify(result);
			}
		} catch (error) {
			const result: PositionAwareTipTapResult = {
				success: false,
				error: `Position-based change failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
			return JSON.stringify(result);
		}
	}

	private fallbackToTextSearch(
		originalText: string,
		suggestedText: string,
		changeType: string,
		confidence: number,
		context?: string
	): string {
		console.log('Falling back to text-based search...');

		// Import the text-based diff creation
		import('$lib/services/transcriptTextReplaceDiff').then(({ findAndCreateDiff }) => {
			const result = findAndCreateDiff(this.editor!, originalText, suggestedText, {
				changeType,
				confidence: confidence * 0.5, // Reduce confidence for fallback
				context,
				caseSensitive: false
			});

			return JSON.stringify({
				...result,
				fallbackUsed: true,
				mappingConfidence: 0.5
			});
		});

		// Return error if import fails
		return JSON.stringify({
			success: false,
			error: 'Failed to load fallback text search',
			fallbackUsed: true
		});
	}
}

export function createPositionAwareTipTapTool(): PositionAwareTipTapTool {
	return new PositionAwareTipTapTool();
}

/**
 * Direct access wrapper for the position-aware tool
 */
export class PositionAwareTipTapToolDirect {
	private tool: PositionAwareTipTapTool;

	constructor() {
		this.tool = new PositionAwareTipTapTool();
	}

	setEditor(editor: Editor) {
		this.tool.setEditor(editor);
	}

	setSegments(segments: PositionAwareSegment[]) {
		this.tool.setSegments(segments);
	}

	async applyPositionBasedChange(input: PositionAwareTipTapInput): Promise<string> {
		return this.tool['applyPositionBasedChange'](input);
	}
}
