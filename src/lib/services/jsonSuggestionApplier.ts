/**
 * Apply ASR correction suggestions directly to editor JSON structure
 * This preserves position accuracy by working with the original JSON format
 */

import type { TipTapEditorContent } from '../../types';
import type { AnalysisSegment } from '@prisma/client';

export interface JsonSuggestion {
	originalText: string;
	suggestedText: string;
	confidence: number;
	from?: number;
	to?: number;
	segmentIndex?: number;
	shouldAutoApply?: boolean;
}

export interface JsonApplyResult {
	success: boolean;
	modifiedContent: TipTapEditorContent;
	appliedCount: number;
	skippedCount: number;
	appliedSuggestions: JsonSuggestion[];
	skippedSuggestions: { suggestion: JsonSuggestion; reason: string }[];
}

/**
 * Convert AnalysisSegment suggestions to JsonSuggestion format
 */
function convertAnalysisSegmentSuggestions(analysisSegments: AnalysisSegment[]): JsonSuggestion[] {
	const suggestions: JsonSuggestion[] = [];

	for (const segment of analysisSegments) {
		try {
			// Parse suggestions JSON
			let parsedSuggestions = segment.suggestions;
			if (typeof parsedSuggestions === 'string') {
				parsedSuggestions = JSON.parse(parsedSuggestions);
			}

			// Handle both array format and object format
			let suggestionArray: any[] = [];
			if (Array.isArray(parsedSuggestions)) {
				suggestionArray = parsedSuggestions;
			} else if (parsedSuggestions && typeof parsedSuggestions === 'object' && 'suggestions' in parsedSuggestions) {
				// Handle wrapped format: { suggestions: [...] }
				const wrapped = parsedSuggestions as any;
				if (Array.isArray(wrapped.suggestions)) {
					suggestionArray = wrapped.suggestions;
				}
			}

			for (const rawSuggestion of suggestionArray) {
				if (rawSuggestion.originalText && rawSuggestion.suggestedText) {
					suggestions.push({
						originalText: rawSuggestion.originalText,
						suggestedText: rawSuggestion.suggestedText,
						confidence: rawSuggestion.confidence || 0.5,
						from: rawSuggestion.from,
						to: rawSuggestion.to,
						segmentIndex: segment.segmentIndex,
						shouldAutoApply: rawSuggestion.shouldAutoApply !== false
					});
				}
			}
		} catch (error) {
			console.error(`Error parsing suggestions for segment ${segment.segmentIndex}:`, error);
		}
	}

	return suggestions;
}

/**
 * Build a character position map of the editor content
 */
function buildPositionMap(content: TipTapEditorContent): Array<{
	charIndex: number;
	nodeType: string;
	nodePos: { speakerIndex: number; contentIndex: number };
	nodeText?: string;
}> {
	const positionMap: Array<{
		charIndex: number;
		nodeType: string;
		nodePos: { speakerIndex: number; contentIndex: number };
		nodeText?: string;
	}> = [];

	let charIndex = 0;

	if (!content || !content.content) return positionMap;

	content.content.forEach((speakerNode, speakerIndex) => {
		if (speakerNode.type !== 'speaker') return;

		if (!speakerNode.content) return;

		speakerNode.content.forEach((node, contentIndex) => {
			if (node.type === 'text' && node.text) {
				positionMap.push({
					charIndex,
					nodeType: 'text',
					nodePos: { speakerIndex, contentIndex },
					nodeText: node.text
				});
				charIndex += node.text.length;
			} else if (node.type === 'wordNode' && node.attrs?.text) {
				positionMap.push({
					charIndex,
					nodeType: 'wordNode',
					nodePos: { speakerIndex, contentIndex },
					nodeText: node.attrs.text
				});
				charIndex += node.attrs.text.length;
			}
		});
	});

	return positionMap;
}

/**
 * Find the node that contains a specific character position
 */
function findNodeAtPosition(
	positionMap: ReturnType<typeof buildPositionMap>,
	charPos: number
): { entry: typeof positionMap[0]; offset: number } | null {
	for (let i = 0; i < positionMap.length; i++) {
		const entry = positionMap[i];
		const nodeLength = entry.nodeText?.length || 0;
		const endPos = entry.charIndex + nodeLength;

		if (charPos >= entry.charIndex && charPos < endPos) {
			return { entry, offset: charPos - entry.charIndex };
		}
	}
	return null;
}

/**
 * Extract full text from editor content for position calculation
 */
function extractFullText(content: TipTapEditorContent): string {
	if (!content || !content.content) return '';

	let fullText = '';

	content.content.forEach((speakerNode) => {
		if (speakerNode.type !== 'speaker') return;
		if (!speakerNode.content) return;

		speakerNode.content.forEach((node) => {
			if (node.type === 'text' && node.text) {
				fullText += node.text;
			} else if (node.type === 'wordNode' && node.attrs?.text) {
				fullText += node.attrs.text;
			}
		});
	});

	return fullText;
}

/**
 * Apply a single suggestion to the editor JSON structure
 */
function applySuggestionToJson(
	content: TipTapEditorContent,
	suggestion: JsonSuggestion
): { success: boolean; error?: string } {
	try {
		// If we have position information, use it directly
		if (typeof suggestion.from === 'number' && typeof suggestion.to === 'number') {
			const positionMap = buildPositionMap(content);
			const startNode = findNodeAtPosition(positionMap, suggestion.from);
			const endNode = findNodeAtPosition(positionMap, suggestion.to - 1);

			if (!startNode || !endNode) {
				return { success: false, error: 'Position not found in document structure' };
			}

			// For simple case where suggestion is within a single node
			if (startNode.entry.nodePos.speakerIndex === endNode.entry.nodePos.speakerIndex &&
				startNode.entry.nodePos.contentIndex === endNode.entry.nodePos.contentIndex) {
				
				const speakerNode = content.content![startNode.entry.nodePos.speakerIndex];
				const targetNode = speakerNode.content![startNode.entry.nodePos.contentIndex];

				if (targetNode.type === 'text' && targetNode.text) {
					// Replace text within the text node
					const originalLength = suggestion.to - suggestion.from;
					const before = targetNode.text.substring(0, startNode.offset);
					const after = targetNode.text.substring(startNode.offset + originalLength);
					targetNode.text = before + suggestion.suggestedText + after;
					return { success: true };
				} else if (targetNode.type === 'wordNode' && targetNode.attrs?.text) {
					// Replace text within the wordNode
					const originalLength = suggestion.to - suggestion.from;
					const before = targetNode.attrs.text.substring(0, startNode.offset);
					const after = targetNode.attrs.text.substring(startNode.offset + originalLength);
					targetNode.attrs.text = before + suggestion.suggestedText + after;
					return { success: true };
				}
			}

			// Multi-node replacement is more complex, skip for now
			return { success: false, error: 'Multi-node replacement not implemented' };
		}

		// Fallback to text-based matching
		const fullText = extractFullText(content);
		const searchIndex = fullText.toLowerCase().indexOf(suggestion.originalText.toLowerCase());
		
		if (searchIndex === -1) {
			return { success: false, error: 'Original text not found in document' };
		}

		// Apply using calculated positions
		return applySuggestionToJson(content, {
			...suggestion,
			from: searchIndex,
			to: searchIndex + suggestion.originalText.length
		});

	} catch (error) {
		return { 
			success: false, 
			error: error instanceof Error ? error.message : 'Unknown error applying suggestion' 
		};
	}
}

/**
 * Apply all suggestions to the editor JSON structure
 */
export function applySuggestionsToJson(
	content: TipTapEditorContent,
	analysisSegments: AnalysisSegment[],
	options: {
		minConfidence?: number;
		applyAll?: boolean;
	} = {}
): JsonApplyResult {
	const { minConfidence = 0.0, applyAll = true } = options;
	
	// Deep clone the content to avoid modifying the original
	const modifiedContent = JSON.parse(JSON.stringify(content)) as TipTapEditorContent;
	
	// Convert all suggestions to our format
	const allSuggestions = convertAnalysisSegmentSuggestions(analysisSegments);
	
	const appliedSuggestions: JsonSuggestion[] = [];
	const skippedSuggestions: { suggestion: JsonSuggestion; reason: string }[] = [];

	// Filter suggestions based on options
	const validSuggestions = allSuggestions.filter(suggestion => {
		if (suggestion.confidence < minConfidence) {
			skippedSuggestions.push({
				suggestion,
				reason: `Confidence ${suggestion.confidence} below threshold ${minConfidence}`
			});
			return false;
		}

		if (!applyAll && !suggestion.shouldAutoApply) {
			skippedSuggestions.push({
				suggestion,
				reason: 'shouldAutoApply is false'
			});
			return false;
		}

		return true;
	});

	// Sort by position (descending) to avoid position shifts
	const sortedSuggestions = validSuggestions.sort((a, b) => {
		if (typeof a.from === 'number' && typeof b.from === 'number') {
			return b.from - a.from;
		}
		return 0;
	});

	// Apply suggestions
	for (const suggestion of sortedSuggestions) {
		const result = applySuggestionToJson(modifiedContent, suggestion);
		
		if (result.success) {
			appliedSuggestions.push(suggestion);
		} else {
			skippedSuggestions.push({
				suggestion,
				reason: result.error || 'Unknown error'
			});
		}
	}

	return {
		success: true,
		modifiedContent,
		appliedCount: appliedSuggestions.length,
		skippedCount: skippedSuggestions.length,
		appliedSuggestions,
		skippedSuggestions
	};
}