import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export interface LLMMetrics {
	model: string;
	finishReason?: string | null;
	totalTokens?: number;
	promptTokens?: number;
	completionTokens?: number;
	cacheHitRate?: number;
	cacheDiscount?: number;
	duration?: number;
}

export interface ConversationEntry {
	timestamp: string;
	type: 'prompt' | 'response';
	content: string;
	metrics?: LLMMetrics;
	interaction?: number; // For agentic loops
}

export class LLMConversationLogger {
	private fileId: string;
	private blockIndex: number;
	private logDir: string;
	private filePath: string;
	private conversation: ConversationEntry[] = [];

	constructor(fileId: string, blockIndex: number, baseLogDir?: string) {
		this.fileId = fileId;
		this.blockIndex = blockIndex;
		this.logDir = baseLogDir || '/tmp/llm-conversations';
		this.filePath = join(this.logDir, `${fileId}_block_${blockIndex}.txt`);
	}

	/**
	 * Log a prompt being sent to the LLM
	 */
	async logPrompt(content: string, model: string, interaction?: number): Promise<void> {
		const entry: ConversationEntry = {
			timestamp: new Date().toISOString(),
			type: 'prompt',
			content,
			metrics: { model },
			interaction
		};

		this.conversation.push(entry);
		await this.writeToFile();
	}

	/**
	 * Log a response received from the LLM
	 */
	async logResponse(
		content: string,
		metrics: LLMMetrics,
		interaction?: number
	): Promise<void> {
		const entry: ConversationEntry = {
			timestamp: new Date().toISOString(),
			type: 'response',
			content,
			metrics,
			interaction
		};

		this.conversation.push(entry);
		await this.writeToFile();
	}

	/**
	 * Write the current conversation to file
	 */
	private async writeToFile(): Promise<void> {
		try {
			// Ensure directory exists
			await fs.mkdir(this.logDir, { recursive: true });

			let fileContent = `# LLM Conversation Log\n`;
			fileContent += `File ID: ${this.fileId}\n`;
			fileContent += `Block Index: ${this.blockIndex}\n`;
			fileContent += `Generated: ${new Date().toISOString()}\n\n`;
			fileContent += `${'='.repeat(80)}\n\n`;

			for (const entry of this.conversation) {
				const header = entry.type === 'prompt' ? 'PROMPT' : 'RESPONSE';
				const interactionInfo = entry.interaction ? ` (Interaction ${entry.interaction})` : '';
				
				fileContent += `## ${header}${interactionInfo}\n`;
				fileContent += `Timestamp: ${entry.timestamp}\n`;
				
				if (entry.metrics) {
					fileContent += `Model: ${entry.metrics.model}\n`;
					if (entry.metrics.finishReason) {
						fileContent += `Finish Reason: ${entry.metrics.finishReason}\n`;
					}
					if (entry.metrics.totalTokens) {
						fileContent += `Total Tokens: ${entry.metrics.totalTokens}\n`;
					}
					if (entry.metrics.promptTokens) {
						fileContent += `Prompt Tokens: ${entry.metrics.promptTokens}\n`;
					}
					if (entry.metrics.completionTokens) {
						fileContent += `Completion Tokens: ${entry.metrics.completionTokens}\n`;
					}
					if (entry.metrics.cacheHitRate !== undefined) {
						fileContent += `Cache Hit Rate: ${entry.metrics.cacheHitRate}%\n`;
					}
					if (entry.metrics.cacheDiscount !== undefined) {
						fileContent += `Cache Discount: ${entry.metrics.cacheDiscount}%\n`;
					}
					if (entry.metrics.duration) {
						fileContent += `Duration: ${entry.metrics.duration}ms\n`;
					}
				}
				
				fileContent += `\nContent Length: ${entry.content.length} characters\n`;
				fileContent += `\n${'-'.repeat(60)}\n`;
				fileContent += `${entry.content}\n`;
				fileContent += `${'-'.repeat(60)}\n\n`;
			}

			await fs.writeFile(this.filePath, fileContent, 'utf8');
		} catch (error) {
			console.error('Failed to write LLM conversation log:', error);
		}
	}

	/**
	 * Get the file path where this conversation is logged
	 */
	getLogFilePath(): string {
		return this.filePath;
	}

	/**
	 * Add a separator for different phases of analysis
	 */
	async addSeparator(title: string): Promise<void> {
		const entry: ConversationEntry = {
			timestamp: new Date().toISOString(),
			type: 'prompt', // Just for formatting
			content: `\n${'='.repeat(20)} ${title.toUpperCase()} ${'='.repeat(20)}\n`
		};
		
		this.conversation.push(entry);
		await this.writeToFile();
	}
}

/**
 * Global registry to manage conversation loggers per block
 */
class ConversationLoggerRegistry {
	private loggers: Map<string, LLMConversationLogger> = new Map();

	getLogger(fileId: string, blockIndex: number): LLMConversationLogger {
		const key = `${fileId}_${blockIndex}`;
		if (!this.loggers.has(key)) {
			this.loggers.set(key, new LLMConversationLogger(fileId, blockIndex));
		}
		return this.loggers.get(key)!;
	}

	clearLogger(fileId: string, blockIndex: number): void {
		const key = `${fileId}_${blockIndex}`;
		this.loggers.delete(key);
	}

	clearAll(): void {
		this.loggers.clear();
	}
}

export const conversationLoggerRegistry = new ConversationLoggerRegistry();

/**
 * Convenience function to get a conversation logger for a specific block
 */
export function getConversationLogger(fileId: string, blockIndex: number): LLMConversationLogger {
	return conversationLoggerRegistry.getLogger(fileId, blockIndex);
}

/**
 * Clean up logger after block processing is complete
 */
export function clearConversationLogger(fileId: string, blockIndex: number): void {
	conversationLoggerRegistry.clearLogger(fileId, blockIndex);
}