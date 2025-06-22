export interface DiffCommand {
	id: string;
	type: 'replace' | 'insert' | 'delete' | 'speaker_change' | 'punctuation' | 'capitalization' | 'spacing' | 'grammar' | 'context' | 'translation';
	start: number;
	end: number;
	originalText?: string;
	newText?: string;
	reason: string;
	confidence: number;
	speakerId?: string;
	speakerName?: string;
	context?: string;
}

export interface DiffSuggestion {
	id: string;
	commands: DiffCommand[];
	description: string;
	confidence: number;
	category?: 'spelling' | 'grammar' | 'punctuation' | 'speaker' | 'context' | 'translation' | 'formatting';
}

// Command types that LLM can propose
export const DIFF_COMMAND_TYPES = {
	REPLACE: 'replace',
	INSERT: 'insert', 
	DELETE: 'delete',
	SPEAKER_CHANGE: 'speaker_change',
	PUNCTUATION: 'punctuation',
	CAPITALIZATION: 'capitalization',
	SPACING: 'spacing',
	GRAMMAR: 'grammar',
	CONTEXT: 'context',
	TRANSLATION: 'translation'
} as const;

// Comprehensive list of LLM commands for transcript correction
export const LLM_COMMANDS = {
	// Text replacement commands
	TEXT_REPLACEMENT: {
		name: 'Text Replacement',
		description: 'Replace incorrect or unclear text with correct text',
		examples: [
			'Correct misspelled words',
			'Replace homophones (e.g., "there" vs "their")',
			'Fix transcription errors',
			'Replace unclear speech with contextually appropriate text'
		]
	},
	
	// Insertion commands
	TEXT_INSERTION: {
		name: 'Text Insertion',
		description: 'Add missing words, punctuation, or context',
		examples: [
			'Add missing articles (a, an, the)',
			'Insert missing punctuation',
			'Add clarifying words',
			'Insert missing spaces between words'
		]
	},
	
	// Deletion commands
	TEXT_DELETION: {
		name: 'Text Deletion',
		description: 'Remove unnecessary or incorrect text',
		examples: [
			'Remove filler words (um, uh, like)',
			'Delete repeated words',
			'Remove false starts',
			'Clean up transcription artifacts'
		]
	},
	
	// Speaker management
	SPEAKER_MANAGEMENT: {
		name: 'Speaker Management',
		description: 'Handle speaker identification and changes',
		examples: [
			'Change speaker attribution',
			'Add new speaker',
			'Merge speaker segments',
			'Split speaker segments'
		]
	},
	
	// Punctuation and formatting
	PUNCTUATION_FORMATTING: {
		name: 'Punctuation and Formatting',
		description: 'Improve punctuation and text formatting',
		examples: [
			'Add or correct punctuation marks',
			'Fix sentence boundaries',
			'Add quotation marks',
			'Format numbers and dates'
		]
	},
	
	// Capitalization
	CAPITALIZATION: {
		name: 'Capitalization',
		description: 'Fix capitalization rules',
		examples: [
			'Capitalize sentence beginnings',
			'Capitalize proper nouns',
			'Fix incorrect capitalization',
			'Handle acronyms and abbreviations'
		]
	},
	
	// Spacing and formatting
	SPACING_FORMATTING: {
		name: 'Spacing and Formatting',
		description: 'Fix spacing and text formatting issues',
		examples: [
			'Add missing spaces',
			'Remove extra spaces',
			'Fix paragraph breaks',
			'Format lists and bullet points'
		]
	},
	
	// Grammar correction
	GRAMMAR_CORRECTION: {
		name: 'Grammar Correction',
		description: 'Fix grammatical errors',
		examples: [
			'Fix verb tense agreement',
			'Correct subject-verb agreement',
			'Fix article usage',
			'Correct word order'
		]
	},
	
	// Context-based corrections
	CONTEXT_CORRECTION: {
		name: 'Context-Based Correction',
		description: 'Improve text based on surrounding context',
		examples: [
			'Clarify ambiguous references',
			'Add context for unclear phrases',
			'Fix contextually inappropriate words',
			'Improve flow and coherence'
		]
	},
	
	// Translation and language
	TRANSLATION_LANGUAGE: {
		name: 'Translation and Language',
		description: 'Handle language-specific corrections',
		examples: [
			'Translate foreign words',
			'Fix language-specific grammar',
			'Handle code-switching',
			'Correct language-specific spelling'
		]
	}
};

// Example commands for testing
export const EXAMPLE_DIFF_COMMANDS: DiffCommand[] = [
	{
		id: '1',
		type: 'replace',
		start: 10,
		end: 15,
		originalText: 'tere',
		newText: 'tere',
		reason: 'Corrected spelling from "tere" to "tere"',
		confidence: 0.95
	},
	{
		id: '2',
		type: 'insert',
		start: 25,
		end: 25,
		newText: ' ',
		reason: 'Added missing space',
		confidence: 0.98
	},
	{
		id: '3',
		type: 'delete',
		start: 30,
		end: 35,
		originalText: 'ummm',
		reason: 'Removed filler word',
		confidence: 0.85
	},
	{
		id: '4',
		type: 'punctuation',
		start: 40,
		end: 45,
		originalText: 'tere.',
		newText: 'tere!',
		reason: 'Changed period to exclamation mark for emphasis',
		confidence: 0.75
	},
	{
		id: '5',
		type: 'capitalization',
		start: 50,
		end: 55,
		originalText: 'tere',
		newText: 'Tere',
		reason: 'Capitalized sentence beginning',
		confidence: 0.90
	}
];

// Function to apply diff commands to editor
export function applyDiffCommands(editor: any, commands: DiffCommand[]): void {
	commands.forEach(command => {
		switch (command.type) {
			case 'replace':
				if (command.originalText && command.newText) {
					editor.commands.setTextSelection({ from: command.start, to: command.end });
					editor.commands.deleteSelection();
					editor.commands.insertContent(command.newText);
				}
				break;
			case 'insert':
				if (command.newText) {
					editor.commands.setTextSelection(command.start);
					editor.commands.insertContent(command.newText);
				}
				break;
			case 'delete':
				editor.commands.setTextSelection({ from: command.start, to: command.end });
				editor.commands.deleteSelection();
				break;
			case 'speaker_change':
				// Handle speaker change logic
				break;
			case 'punctuation':
			case 'capitalization':
			case 'spacing':
			case 'grammar':
			case 'context':
			case 'translation':
				if (command.originalText && command.newText) {
					editor.commands.setTextSelection({ from: command.start, to: command.end });
					editor.commands.deleteSelection();
					editor.commands.insertContent(command.newText);
				}
				break;
		}
	});
}

// Function to create diff marks for visualization
export function createDiffMarks(editor: any, commands: DiffCommand[]): void {
	commands.forEach(command => {
		switch (command.type) {
			case 'replace':
				if (command.originalText) {
					// Mark original text for deletion
					editor.commands.setTextSelection({ from: command.start, to: command.end });
					editor.commands.setDiff({ type: 'deletion', reason: command.reason });
				}
				if (command.newText) {
					// Insert new text with addition mark
					editor.commands.setTextSelection(command.start);
					editor.commands.insertContent(command.newText);
					editor.commands.setTextSelection({ 
						from: command.start, 
						to: command.start + command.newText.length 
					});
					editor.commands.setDiff({ type: 'addition', reason: command.reason });
				}
				break;
			case 'insert':
				if (command.newText) {
					editor.commands.setTextSelection(command.start);
					editor.commands.insertContent(command.newText);
					editor.commands.setTextSelection({ 
						from: command.start, 
						to: command.start + command.newText.length 
					});
					editor.commands.setDiff({ type: 'addition', reason: command.reason });
				}
				break;
			case 'delete':
				editor.commands.setTextSelection({ from: command.start, to: command.end });
				editor.commands.setDiff({ type: 'deletion', reason: command.reason });
				break;
		}
	});
}

// Function to clear all diff marks
export function clearDiffMarks(editor: any): void {
	editor.commands.unsetDiff();
}

// Function to validate diff commands
export function validateDiffCommand(command: DiffCommand): boolean {
	if (!command.id || !command.type || command.start < 0 || command.end < command.start) {
		return false;
	}
	
	switch (command.type) {
		case 'replace':
			return !!(command.originalText && command.newText);
		case 'insert':
			return !!command.newText;
		case 'delete':
			return !!command.originalText;
		case 'speaker_change':
			return !!(command.speakerId || command.speakerName);
		default:
			return !!(command.originalText && command.newText);
	}
} 