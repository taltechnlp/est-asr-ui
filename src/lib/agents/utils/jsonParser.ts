/**
 * Robust JSON parser utility with multiple extraction and fixing strategies
 * Designed to handle LLM responses that may contain mixed content or malformed JSON
 */

export interface ParseResult {
	success: boolean;
	data?: any;
	error?: string;
	rawInput?: string;
	extractedJson?: string;
	fixesApplied?: string[];
}

/**
 * Main function to robustly parse JSON from potentially mixed content
 */
export function robustJsonParse(input: string): ParseResult {
	if (!input || typeof input !== 'string') {
		return {
			success: false,
			error: 'Invalid input: expected non-empty string',
			rawInput: String(input)
		};
	}

	const fixesApplied: string[] = [];

	// Strategy 1: Try direct parsing first
	try {
		const data = JSON.parse(input);
		return {
			success: true,
			data,
			rawInput: input,
			extractedJson: input
		};
	} catch (e) {
		// Continue to extraction strategies
	}

	// Strategy 2: Extract JSON from mixed content
	let extracted = extractJsonFromMixedContent(input);
	if (extracted) {
		fixesApplied.push('Extracted JSON from mixed content');

		// Try parsing the extracted content
		try {
			const data = JSON.parse(extracted);
			return {
				success: true,
				data,
				rawInput: input,
				extractedJson: extracted,
				fixesApplied
			};
		} catch (e) {
			// Continue to fixing strategies
		}
	} else {
		// If no JSON structure found, try the whole input
		extracted = input;
	}

	// Strategy 3: Apply fixes and try parsing
	const fixed = applyJsonFixes(extracted, fixesApplied);

	try {
		const data = JSON.parse(fixed);
		return {
			success: true,
			data,
			rawInput: input,
			extractedJson: fixed,
			fixesApplied
		};
	} catch (parseError) {
		// Strategy 4: Try to extract and fix arrays specifically
		const arrayExtracted = extractJsonArray(input);
		if (arrayExtracted) {
			fixesApplied.push('Extracted JSON array');
			const arrayFixed = applyJsonFixes(arrayExtracted, fixesApplied);
			try {
				const data = JSON.parse(arrayFixed);
				return {
					success: true,
					data,
					rawInput: input,
					extractedJson: arrayFixed,
					fixesApplied
				};
			} catch (e) {
				// Fall through to error
			}
		}

		return {
			success: false,
			error: `Failed to parse JSON: ${parseError}`,
			rawInput: input,
			extractedJson: fixed,
			fixesApplied
		};
	}
}

/**
 * Extract JSON object or array from mixed content
 */
function extractJsonFromMixedContent(input: string): string | null {
	// Remove markdown code blocks if present
	const codeBlockMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (codeBlockMatch) {
		input = codeBlockMatch[1];
	}

	// Try to find JSON object
	const objectMatches = findBalancedBraces(input, '{', '}');
	if (objectMatches.length > 0) {
		// Return the largest valid JSON object found
		return objectMatches.sort((a, b) => b.length - a.length)[0];
	}

	// Try to find JSON array
	const arrayMatches = findBalancedBraces(input, '[', ']');
	if (arrayMatches.length > 0) {
		return arrayMatches.sort((a, b) => b.length - a.length)[0];
	}

	return null;
}

/**
 * Extract JSON array specifically (for suggestions arrays)
 */
function extractJsonArray(input: string): string | null {
	// Look for array pattern
	const arrayMatch = input.match(/\[\s*\{[\s\S]*?\}\s*\]/);
	if (arrayMatch) {
		return arrayMatch[0];
	}

	// Try balanced bracket approach
	const matches = findBalancedBraces(input, '[', ']');
	return matches.length > 0 ? matches[0] : null;
}

/**
 * Find all balanced brace/bracket pairs in text
 */
function findBalancedBraces(text: string, open: string, close: string): string[] {
	const results: string[] = [];
	let start = 0;

	while (start < text.length) {
		const openIdx = text.indexOf(open, start);
		if (openIdx === -1) break;

		let depth = 1;
		let current = openIdx + 1;
		let inString = false;
		let escapeNext = false;

		while (current < text.length && depth > 0) {
			const char = text[current];

			if (escapeNext) {
				escapeNext = false;
			} else if (char === '\\') {
				escapeNext = true;
			} else if (char === '"' && !escapeNext) {
				inString = !inString;
			} else if (!inString) {
				if (char === open) {
					depth++;
				} else if (char === close) {
					depth--;
				}
			}

			current++;
		}

		if (depth === 0) {
			results.push(text.substring(openIdx, current));
		}

		start = openIdx + 1;
	}

	return results;
}

/**
 * Apply common JSON fixes
 */
function applyJsonFixes(json: string, fixesApplied: string[]): string {
	let fixed = json;

	// Remove BOM if present
	if (fixed.charCodeAt(0) === 0xfeff) {
		fixed = fixed.slice(1);
		fixesApplied.push('Removed BOM');
	}

	// Remove control characters except valid JSON whitespace
	const beforeControl = fixed;
	fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
	if (fixed !== beforeControl) {
		fixesApplied.push('Removed control characters');
	}

	// Replace non-breaking spaces
	if (fixed.includes('\u00A0')) {
		fixed = fixed.replace(/\u00A0/g, ' ');
		fixesApplied.push('Replaced non-breaking spaces');
	}

	// Fix quotes - normalize smart quotes
	if (fixed.match(/[\u2018\u2019\u201C\u201D]/)) {
		fixed = fixed.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
		fixesApplied.push('Normalized smart quotes');
	}

	// Fix single quotes in JSON keys and values (but not inside strings)
	// This is a simplified approach - be careful with it
	const singleQuotePattern = /(?<!")'\s*:\s*'/g;
	if (fixed.match(singleQuotePattern)) {
		fixed = fixed.replace(/(?<!")'/g, '"');
		fixesApplied.push('Replaced single quotes with double quotes');
	}

	// Remove trailing commas in objects
	const trailingCommaObject = /,\s*}/g;
	if (fixed.match(trailingCommaObject)) {
		fixed = fixed.replace(trailingCommaObject, '}');
		fixesApplied.push('Removed trailing commas in objects');
	}

	// Remove trailing commas in arrays
	const trailingCommaArray = /,\s*\]/g;
	if (fixed.match(trailingCommaArray)) {
		fixed = fixed.replace(trailingCommaArray, ']');
		fixesApplied.push('Removed trailing commas in arrays');
	}

	// Remove comments (// and /* */)
	const beforeComments = fixed;
	fixed = fixed
		.replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
		.replace(/\/\/.*$/gm, ''); // Line comments
	if (fixed !== beforeComments) {
		fixesApplied.push('Removed comments');
	}

	// Escape unescaped quotes inside string values (basic approach)
	// This is complex and might need more sophisticated handling
	try {
		// Try to detect and fix unescaped quotes
		const lines = fixed.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Look for string values that might have unescaped quotes
			const stringValueMatch = line.match(/:\s*"([^"]*"[^"]*)"(?:\s*[,\}])/);
			if (stringValueMatch) {
				const value = stringValueMatch[1];
				const escaped = value.replace(/(?<!\\)"/g, '\\"');
				lines[i] = line.replace(value, escaped);
				if (escaped !== value) {
					fixesApplied.push('Escaped quotes in string values');
				}
			}
		}
		fixed = lines.join('\n');
	} catch (e) {
		// Skip if regex fails
	}

	// Remove any text before first { or [
	const jsonStart = Math.min(
		fixed.indexOf('{') !== -1 ? fixed.indexOf('{') : Infinity,
		fixed.indexOf('[') !== -1 ? fixed.indexOf('[') : Infinity
	);
	if (jsonStart > 0 && jsonStart !== Infinity) {
		fixed = fixed.substring(jsonStart);
		fixesApplied.push('Removed text before JSON');
	}

	// Remove any text after last } or ]
	const lastClose = Math.max(fixed.lastIndexOf('}'), fixed.lastIndexOf(']'));
	if (lastClose !== -1 && lastClose < fixed.length - 1) {
		// Check if there's meaningful content after
		const after = fixed.substring(lastClose + 1).trim();
		if (after && !after.match(/^[\s,;]*$/)) {
			fixed = fixed.substring(0, lastClose + 1);
			fixesApplied.push('Removed text after JSON');
		}
	}

	return fixed.trim();
}

/**
 * Validate JSON structure matches expected schema
 */
export function validateJsonStructure(data: any, expectedKeys?: string[]): boolean {
	if (!data || typeof data !== 'object') {
		return false;
	}

	if (expectedKeys) {
		for (const key of expectedKeys) {
			if (!(key in data)) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Format parsing error for LLM feedback
 */
export function formatParsingErrorForLLM(error: string, input: string): string {
	const preview = input.length > 500 ? input.substring(0, 500) + '...' : input;

	return `JSON Parsing Error:
${error}

The response that failed to parse:
${preview}

Common issues to check:
1. Ensure the response contains ONLY valid JSON
2. No text before or after the JSON structure
3. All strings must use double quotes, not single quotes
4. No trailing commas in objects or arrays
5. All quotes inside strings must be escaped with \\
6. No comments are allowed in JSON`;
}
