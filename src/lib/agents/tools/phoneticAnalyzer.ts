import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { TranscriptAnalysisTool } from './base';
import { robustJsonParse } from '../utils/jsonParser';
import { getCurrentLogger } from '../../utils/agentFileLogger';

const execAsync = promisify(exec);

const PhoneticAnalyzerSchema = z.object({
	text: z.string().describe('Original text to analyze phonetically'),
	candidate: z.string().describe('Candidate text to compare against')
});

export interface PhoneticAnalysisResult {
	original_text: string;
	candidate_text: string;
	original_phonetic: string;
	candidate_phonetic: string;
	similarity_score: number;
	confidence: 'low' | 'medium' | 'high';
	is_homophone: boolean;
	is_likely_asr_error: boolean;
	phoneme_count_original: number;
	phoneme_count_candidate: number;
	method: 'et-g2p-fst' | 'fallback';
}

/**
 * Phonetic Analyzer Tool for Estonian ASR Error Correction
 *
 * This tool provides phonetic analysis capabilities as specified in theory.md:
 * - Converts Estonian text to phonetic representations
 * - Calculates phonetic similarity between word pairs
 * - Identifies potential ASR errors based on phonetic similarity
 *
 * Uses the et-g2p-fst Estonian phonetic conversion system via Python subprocess.
 */
export class PhoneticAnalyzerTool extends TranscriptAnalysisTool {
	private scriptPath: string;
	private pythonCommand: string;
	private isAvailable: boolean = true;

	constructor(pythonCommand: string = 'python3', scriptPath?: string) {
		super(
			'phonetic_analyzer',
			`Analyzes phonetic similarity between Estonian words to detect potential ASR errors.
      
This tool is particularly effective for:
- Detecting homophone substitutions (e.g., "there" vs "their" equivalents in Estonian)
- Identifying phonetically similar word errors (e.g., "protocol" vs "prototype")
- Validating named entity transcriptions that may have been phonetically guessed
- Assessing the likelihood that one word is an ASR error for another

The tool returns phonetic representations and a similarity score between 0.0 and 1.0.
High similarity scores (>0.7) suggest the candidate could be a plausible ASR error for the original text.

Input: Original text and candidate replacement text
Output: Detailed phonetic analysis including similarity score and confidence assessment`,
			PhoneticAnalyzerSchema,
			(input: any) => this._call(input)
		);

		this.pythonCommand = pythonCommand;
		this.scriptPath = scriptPath || join(process.cwd(), 'scripts', 'phonetic_analyzer.py');

		// Initialization logging moved to file logger when analysis starts

		// Test availability on initialization (don't await in constructor)
		this.testAvailability().catch(() => {
			this.isAvailable = false;
		});
	}

	private async testAvailability(): Promise<void> {
		try {
			const testCommand = `${this.pythonCommand} "${this.scriptPath}" encode test`;
			const { stdout, stderr } = await execAsync(testCommand);

			// Try to parse the output
			const parseResult = robustJsonParse(stdout);
			if (parseResult.success) {
				this.isAvailable = true;
			} else {
				this.isAvailable = false;
			}
		} catch (error) {
			this.isAvailable = false;
		}
	}

	async _call(input: z.infer<typeof PhoneticAnalyzerSchema>): Promise<string> {
		const result = await this.analyzePhoneticSimilarity(input);
		return JSON.stringify(result);
	}

	/**
	 * Analyze phonetic similarity between two Estonian texts
	 */
	async analyzePhoneticSimilarity(
		input: z.infer<typeof PhoneticAnalyzerSchema>
	): Promise<PhoneticAnalysisResult> {
		const { text, candidate } = input;
		const logger = getCurrentLogger();

		await logger?.logToolExecution('PhoneticAnalyzer', 'Starting phonetic similarity analysis', {
			originalText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
			candidateText: candidate.substring(0, 100) + (candidate.length > 100 ? '...' : ''),
			originalLength: text.length,
			candidateLength: candidate.length
		});

		if (!this.isAvailable) {
			await logger?.logToolExecution(
				'PhoneticAnalyzer',
				'Tool not available, using fallback result'
			);
			return this.createFallbackResult(text, candidate);
		}

		try {
			// Escape arguments for shell execution
			const escapedText = text.replace(/"/g, '\\"');
			const escapedCandidate = candidate.replace(/"/g, '\\"');

			const command = `${this.pythonCommand} "${this.scriptPath}" analyze "${escapedText}" "${escapedCandidate}"`;

			await logger?.logToolExecution('PhoneticAnalyzer', 'Executing phonetic analysis command', {
				command: command.replace(this.scriptPath, '[script]'),
				timeout: '10s',
				maxBuffer: '1MB'
			});

			const { stdout, stderr } = await execAsync(command, {
				timeout: 10000, // 10 second timeout
				maxBuffer: 1024 * 1024 // 1MB buffer
			});

			if (stderr) {
				await logger?.logToolExecution('PhoneticAnalyzer', 'Python script generated warnings', {
					warnings: stderr
				});
			}

			await logger?.logToolExecution('PhoneticAnalyzer', 'Received Python output', {
				outputLength: stdout.length,
				outputPreview: stdout.substring(0, 200) + (stdout.length > 200 ? '...' : '')
			});

			// Parse the JSON response
			const parseResult = robustJsonParse(stdout);
			if (!parseResult.success) {
				await logger?.logToolExecution('PhoneticAnalyzer', 'Failed to parse JSON response', {
					error: parseResult.error,
					rawOutput: stdout.substring(0, 500)
				});
				throw new Error(`Invalid phonetic analysis response: ${parseResult.error}`);
			}

			const result = parseResult.data as PhoneticAnalysisResult;

			// Validate the response structure
			if (!result.similarity_score && result.similarity_score !== 0) {
				await logger?.logToolExecution('PhoneticAnalyzer', 'Invalid response structure', {
					error: 'missing similarity_score',
					result
				});
				throw new Error('Invalid response: missing similarity_score');
			}

			await logger?.logToolExecution('PhoneticAnalyzer', 'Analysis completed successfully', {
				originalPhonetic: result.original_phonetic,
				candidatePhonetic: result.candidate_phonetic,
				similarityScore: result.similarity_score,
				confidence: result.confidence,
				isLikelyASRError: result.is_likely_asr_error,
				method: result.method
			});

			return result;
		} catch (error) {
			await logger?.logToolExecution('PhoneticAnalyzer', 'Analysis failed with error', {
				error: error instanceof Error ? { message: error.message, stack: error.stack } : error
			});

			// Return fallback result instead of throwing
			await logger?.logToolExecution('PhoneticAnalyzer', 'Returning fallback result due to error');
			return this.createFallbackResult(text, candidate);
		}
	}

	/**
	 * Create a fallback result when the Python script is not available
	 */
	private createFallbackResult(text: string, candidate: string): PhoneticAnalysisResult {
		// Simple character-based similarity as fallback
		const similarity = this.calculateSimpleSimilarity(text, candidate);

		return {
			original_text: text,
			candidate_text: candidate,
			original_phonetic: text
				.toUpperCase()
				.replace(/[^A-ZÜÕÄÖ]/g, ' ')
				.trim(),
			candidate_phonetic: candidate
				.toUpperCase()
				.replace(/[^A-ZÜÕÄÖ]/g, ' ')
				.trim(),
			similarity_score: similarity,
			confidence: similarity >= 0.8 ? 'high' : similarity >= 0.6 ? 'medium' : 'low',
			is_homophone: similarity >= 0.95,
			is_likely_asr_error: similarity >= 0.7 && similarity < 0.95,
			phoneme_count_original: text.length,
			phoneme_count_candidate: candidate.length,
			method: 'fallback'
		};
	}

	/**
	 * Simple character-based similarity calculation for fallback
	 */
	private calculateSimpleSimilarity(text1: string, text2: string): number {
		const s1 = text1.toLowerCase();
		const s2 = text2.toLowerCase();

		if (s1 === s2) return 1.0;
		if (!s1 || !s2) return 0.0;

		const maxLen = Math.max(s1.length, s2.length);
		let matches = 0;

		for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
			if (s1[i] === s2[i]) matches++;
		}

		return matches / maxLen;
	}

	/**
	 * Encode a single word/phrase to phonetic representation
	 */
	async encodePhonetic(text: string): Promise<string> {
		if (!this.isAvailable) {
			return text
				.toUpperCase()
				.replace(/[^A-ZÜÕÄÖ]/g, ' ')
				.trim();
		}

		try {
			const escapedText = text.replace(/"/g, '\\"');
			const command = `${this.pythonCommand} "${this.scriptPath}" encode "${escapedText}"`;

			const { stdout } = await execAsync(command, { timeout: 5000 });
			const parseResult = robustJsonParse(stdout);

			if (parseResult.success && parseResult.data.phonetic) {
				return parseResult.data.phonetic;
			}

			throw new Error('Invalid encode response');
		} catch (error) {
			// Phonetic encoding failed, using fallback
			return text
				.toUpperCase()
				.replace(/[^A-ZÜÕÄÖ]/g, ' ')
				.trim();
		}
	}

	/**
	 * Check if the tool is available and working
	 */
	isToolAvailable(): boolean {
		return this.isAvailable;
	}
}

/**
 * Factory function to create a PhoneticAnalyzerTool instance
 */
export function createPhoneticAnalyzerTool(
	pythonCommand?: string,
	scriptPath?: string
): PhoneticAnalyzerTool {
	return new PhoneticAnalyzerTool(pythonCommand, scriptPath);
}
