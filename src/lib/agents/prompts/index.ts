// Centralized prompt management for coordination agents
// Allows easy switching between different prompt strategies

// Note: WER_FOCUSED prompts moved to wer_analysis.ts for the new agentic approach

import { LEGACY_SEGMENT_ANALYSIS_PROMPT, LEGACY_ENHANCED_ANALYSIS_PROMPT } from './legacy_analysis';

import {
	NO_SECONDARY_ASR_SEGMENT_ANALYSIS_PROMPT,
	NO_SECONDARY_ASR_ENHANCED_ANALYSIS_PROMPT
} from './no_secondary_asr_analysis';

export type PromptStrategy = 'legacy' | 'no_secondary_asr';

export interface PromptSet {
	SEGMENT_ANALYSIS_PROMPT: string;
	ENHANCED_ANALYSIS_PROMPT: string;
}

const PROMPT_STRATEGIES: Record<PromptStrategy, PromptSet> = {
	legacy: {
		SEGMENT_ANALYSIS_PROMPT: LEGACY_SEGMENT_ANALYSIS_PROMPT,
		ENHANCED_ANALYSIS_PROMPT: LEGACY_ENHANCED_ANALYSIS_PROMPT
	},
	no_secondary_asr: {
		SEGMENT_ANALYSIS_PROMPT: NO_SECONDARY_ASR_SEGMENT_ANALYSIS_PROMPT,
		ENHANCED_ANALYSIS_PROMPT: NO_SECONDARY_ASR_ENHANCED_ANALYSIS_PROMPT
	}
};

/**
 * Get prompts for a specific strategy
 */
export function getPrompts(strategy: PromptStrategy = 'legacy'): PromptSet {
	return PROMPT_STRATEGIES[strategy];
}

/**
 * Get available prompt strategies
 */
export function getAvailableStrategies(): PromptStrategy[] {
	return Object.keys(PROMPT_STRATEGIES) as PromptStrategy[];
}

// Default export for backwards compatibility
export const { SEGMENT_ANALYSIS_PROMPT, ENHANCED_ANALYSIS_PROMPT } = getPrompts('legacy');

// Export individual prompt sets for direct access  
export { LEGACY_SEGMENT_ANALYSIS_PROMPT, LEGACY_ENHANCED_ANALYSIS_PROMPT } from './legacy_analysis';

export {
	NO_SECONDARY_ASR_SEGMENT_ANALYSIS_PROMPT,
	NO_SECONDARY_ASR_ENHANCED_ANALYSIS_PROMPT
} from './no_secondary_asr_analysis';
