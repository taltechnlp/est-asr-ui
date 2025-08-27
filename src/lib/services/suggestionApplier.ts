/**
 * Utility for applying ASR correction suggestions to text in a position-safe manner
 * Used for benchmarking - applies suggestions without complex editor state management
 */

export interface Suggestion {
	originalText: string;
	suggestedText: string;
	confidence: number;
	from?: number;
	to?: number;
	segmentIndex?: number;
	shouldAutoApply?: boolean;
}

export interface ApplySuggestionsResult {
	modifiedText: string;
	appliedCount: number;
	skippedCount: number;
	appliedSuggestions: Suggestion[];
	skippedSuggestions: { suggestion: Suggestion; reason: string }[];
}

/**
 * Check if a suggestion would add duplicate punctuation
 * This catches cases where the agent suggests adding punctuation that already exists
 */
function isDuplicatePunctuationSuggestion(suggestion: Suggestion, fullText: string): boolean {
	const { originalText, suggestedText } = suggestion;
	
	// Check if the suggestion only adds punctuation at the end
	const originalTrimmed = originalText.trim();
	const suggestedTrimmed = suggestedText.trim();
	
	// Check if suggested text is just original + punctuation
	const punctuationChars = ['.', '!', '?', ',', ';', ':'];
	
	for (const punct of punctuationChars) {
		if (suggestedTrimmed === originalTrimmed + punct) {
			// The suggestion adds punctuation. Check if the text already has this punctuation
			
			// Method 1: Check by position if available
			if (typeof suggestion.from === 'number' && typeof suggestion.to === 'number') {
				const textAfterPosition = fullText.substring(suggestion.to);
				// Check if there's already punctuation immediately after
				if (textAfterPosition.startsWith(punct)) {
					return true; // Duplicate punctuation would result
				}
			}
			
			// Method 2: Check if the original text in context already ends with punctuation
			const originalInContextLower = originalText.toLowerCase().trim();
			const indexInText = fullText.toLowerCase().indexOf(originalInContextLower);
			
			if (indexInText !== -1) {
				const endPosition = indexInText + originalInContextLower.length;
				const charAfter = fullText.charAt(endPosition);
				
				if (charAfter === punct) {
					return true; // Would create duplicate punctuation
				}
			}
			
			// Method 3: Check if the original text already ends with the same punctuation
			if (originalTrimmed.endsWith(punct)) {
				return true; // Already has the punctuation
			}
		}
	}
	
	return false;
}

/**
 * Apply suggestions to a text string in position-safe manner
 * Suggestions are applied in reverse order (highest position first) to preserve positions
 */
export function applySuggestionsToText(
	text: string,
	suggestions: Suggestion[],
	options: {
		minConfidence?: number;
		applyAll?: boolean;
	} = {}
): ApplySuggestionsResult {
	const { minConfidence = 0.0, applyAll = true } = options;
	
	let modifiedText = text;
	const appliedSuggestions: Suggestion[] = [];
	const skippedSuggestions: { suggestion: Suggestion; reason: string }[] = [];

	// Filter and validate suggestions
	const validSuggestions = suggestions.filter(suggestion => {
		if (!suggestion.originalText || !suggestion.suggestedText) {
			skippedSuggestions.push({
				suggestion,
				reason: 'Missing originalText or suggestedText'
			});
			return false;
		}

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

		// Check for duplicate punctuation issues
		if (isDuplicatePunctuationSuggestion(suggestion, text)) {
			skippedSuggestions.push({
				suggestion,
				reason: 'Suggestion would add duplicate punctuation'
			});
			return false;
		}

		return true;
	});

	// For suggestions with positions, sort by position (descending - apply from end to start)
	const suggestionsWithPositions = validSuggestions.filter(s => 
		typeof s.from === 'number' && typeof s.to === 'number'
	).sort((a, b) => (b.from || 0) - (a.from || 0));

	// Apply position-based suggestions first
	for (const suggestion of suggestionsWithPositions) {
		const from = suggestion.from!;
		const to = suggestion.to!;

		// Validate position bounds
		if (from < 0 || to > modifiedText.length || from > to) {
			skippedSuggestions.push({
				suggestion,
				reason: `Invalid positions: [${from}, ${to}] for text length ${modifiedText.length}`
			});
			continue;
		}

		// Check if the original text at position matches
		const textAtPosition = modifiedText.substring(from, to);
		if (textAtPosition.trim().toLowerCase() !== suggestion.originalText.trim().toLowerCase()) {
			skippedSuggestions.push({
				suggestion,
				reason: `Text mismatch at position [${from}, ${to}]: expected "${suggestion.originalText}", found "${textAtPosition}"`
			});
			continue;
		}

		// Apply the replacement
		modifiedText = modifiedText.substring(0, from) + 
					   suggestion.suggestedText + 
					   modifiedText.substring(to);
		
		appliedSuggestions.push(suggestion);
	}

	// For suggestions without positions, try to find and replace by text content
	const suggestionsWithoutPositions = validSuggestions.filter(s => 
		typeof s.from !== 'number' || typeof s.to !== 'number'
	);

	for (const suggestion of suggestionsWithoutPositions) {
		const searchText = suggestion.originalText;
		
		// Try case-sensitive match first
		let index = modifiedText.indexOf(searchText);
		
		// If not found, try case-insensitive
		if (index === -1) {
			const lowerText = modifiedText.toLowerCase();
			const lowerSearch = searchText.toLowerCase();
			index = lowerText.indexOf(lowerSearch);
			
			if (index !== -1) {
				// Found case-insensitive match, get the actual case from the text
				const actualText = modifiedText.substring(index, index + searchText.length);
				// Verify it's really the same text (ignoring case)
				if (actualText.toLowerCase() === lowerSearch) {
					// Apply replacement
					modifiedText = modifiedText.substring(0, index) + 
								   suggestion.suggestedText + 
								   modifiedText.substring(index + searchText.length);
					
					appliedSuggestions.push(suggestion);
					continue;
				}
			}
		} else {
			// Found exact match
			modifiedText = modifiedText.substring(0, index) + 
						   suggestion.suggestedText + 
						   modifiedText.substring(index + searchText.length);
			
			appliedSuggestions.push(suggestion);
			continue;
		}

		// If we reach here, text was not found
		skippedSuggestions.push({
			suggestion,
			reason: `Text "${searchText}" not found in segment`
		});
	}

	return {
		modifiedText,
		appliedCount: appliedSuggestions.length,
		skippedCount: skippedSuggestions.length,
		appliedSuggestions,
		skippedSuggestions
	};
}

/**
 * Apply suggestions to multiple text segments
 * Each segment is processed independently with its own suggestions
 */
export function applySuggestionsToSegments(
	segments: { text: string; suggestions: Suggestion[] }[],
	options: {
		minConfidence?: number;
		applyAll?: boolean;
	} = {}
): {
	modifiedSegments: string[];
	totalApplied: number;
	totalSkipped: number;
	segmentResults: ApplySuggestionsResult[];
} {
	const segmentResults: ApplySuggestionsResult[] = [];
	const modifiedSegments: string[] = [];
	let totalApplied = 0;
	let totalSkipped = 0;

	for (const segment of segments) {
		const result = applySuggestionsToText(segment.text, segment.suggestions, options);
		
		segmentResults.push(result);
		modifiedSegments.push(result.modifiedText);
		totalApplied += result.appliedCount;
		totalSkipped += result.skippedCount;
	}

	return {
		modifiedSegments,
		totalApplied,
		totalSkipped,
		segmentResults
	};
}

/**
 * Clean text for benchmarking export
 * Removes extra whitespace and normalizes line breaks
 */
export function cleanTextForExport(text: string): string {
	return text
		// Normalize whitespace
		.replace(/\s+/g, ' ')
		// Remove leading/trailing whitespace
		.trim()
		// Remove any remaining control characters except newlines
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}