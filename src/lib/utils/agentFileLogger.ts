import { promises as fs } from 'fs';
import path from 'path';

export interface LogEntry {
	timestamp: string;
	level: 'info' | 'warn' | 'error' | 'debug';
	type: 'llm_request' | 'llm_response' | 'tool_call' | 'tool_response' | 'general';
	message: string;
	data?: any;
	fileId?: string;
	segmentIndex?: number;
	duration?: number;
}

export class AgentFileLogger {
	private logFilePath: string;
	private fileId: string;
	private initialized = false;
	private writeQueue: Promise<void> = Promise.resolve();
	private loggedFilePath = false;

	constructor(transcriptFilePath: string, fileId: string) {
		this.fileId = fileId;
		
		// Generate log file path from transcript path
		const dir = path.dirname(transcriptFilePath);
		const basename = path.basename(transcriptFilePath, path.extname(transcriptFilePath));
		this.logFilePath = path.join(dir, `${basename}.agent-log.json`);
	}

	private async ensureLogFile(): Promise<void> {
		if (this.initialized) return;

		try {
			// Create directory if it doesn't exist
			await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
			
			// Check if log file exists
			try {
				await fs.access(this.logFilePath);
			} catch {
				// File doesn't exist, create it with initial structure
				const initialData = {
					fileId: this.fileId,
					created: new Date().toISOString(),
					version: '1.0',
					entries: []
				};
				await fs.writeFile(this.logFilePath, JSON.stringify(initialData, null, 2));
			}
			
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize agent log file:', error);
			throw error;
		}
	}

	async log(entry: Omit<LogEntry, 'timestamp' | 'fileId'>): Promise<void> {
		// Queue the write operation to prevent concurrent access
		this.writeQueue = this.writeQueue.then(async () => {
			try {
				await this.ensureLogFile();

				const logEntry: LogEntry = {
					...entry,
					timestamp: new Date().toISOString(),
					fileId: this.fileId
				};

				// Log the file path once for easy access
				if (!this.loggedFilePath) {
					console.log(`📝 Agent log file: ${this.logFilePath}`);
					this.loggedFilePath = true;
				}

				// Safely read and parse the log file
				let logData;
				try {
					const fileContent = await fs.readFile(this.logFilePath, 'utf8');
					if (!fileContent.trim()) {
						// Empty file, create initial structure
						logData = {
							fileId: this.fileId,
							created: new Date().toISOString(),
							version: '1.0',
							entries: []
						};
					} else {
						logData = JSON.parse(fileContent);
					}
				} catch (parseError) {
					console.warn('Failed to parse existing log file, creating new one:', parseError);
					// If JSON is corrupted, start fresh
					logData = {
						fileId: this.fileId,
						created: new Date().toISOString(),
						version: '1.0',
						entries: []
					};
				}
				
				// Add new entry
				logData.entries.push(logEntry);
				
				// Write back to file with error recovery
				const newContent = JSON.stringify(logData, null, 2);
				await fs.writeFile(this.logFilePath, newContent);

			} catch (error) {
				console.error('Failed to write to agent log file:', error);
				// Don't throw - logging should never break the main flow
			}
		});

		// Return the queued promise so callers can await if needed
		// But don't propagate errors to avoid breaking the queue
		return this.writeQueue.catch(() => {
			// Errors are already logged, just silently continue
		});
	}

	async logLLMRequest(prompt: string, model: string, segmentIndex?: number): Promise<void> {
		await this.log({
			level: 'info',
			type: 'llm_request',
			message: `LLM request to ${model}`,
			data: {
				model,
				promptLength: prompt.length,
				promptPreview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : '')
			},
			segmentIndex
		});
	}

	async logLLMResponse(response: string, duration: number, segmentIndex?: number): Promise<void> {
		await this.log({
			level: 'info',
			type: 'llm_response',
			message: `LLM response received`,
			data: {
				responseLength: response.length,
				responsePreview: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
				fullResponse: response // Store full response for debugging
			},
			duration,
			segmentIndex
		});
	}

	async logToolCall(toolName: string, input: any, segmentIndex?: number): Promise<void> {
		await this.log({
			level: 'info',
			type: 'tool_call',
			message: `Tool called: ${toolName}`,
			data: {
				toolName,
				input
			},
			segmentIndex
		});
	}

	async logToolExecution(toolName: string, message: string, data?: any, segmentIndex?: number): Promise<void> {
		await this.log({
			level: 'info',
			type: 'tool_call',
			message: `${toolName}: ${message}`,
			data: {
				toolName,
				...data
			},
			segmentIndex
		});
	}

	async logToolResponse(toolName: string, output: any, duration: number, segmentIndex?: number): Promise<void> {
		await this.log({
			level: 'info',
			type: 'tool_response',
			message: `Tool response: ${toolName}`,
			data: {
				toolName,
				output,
				success: true
			},
			duration,
			segmentIndex
		});
	}

	async logToolError(toolName: string, error: any, duration: number, segmentIndex?: number): Promise<void> {
		await this.log({
			level: 'error',
			type: 'tool_response',
			message: `Tool error: ${toolName}`,
			data: {
				toolName,
				error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
				success: false
			},
			duration,
			segmentIndex
		});
	}

	async logGeneral(level: LogEntry['level'], message: string, data?: any, segmentIndex?: number): Promise<void> {
		await this.log({
			level,
			type: 'general',
			message,
			data,
			segmentIndex
		});
	}

	getLogFilePath(): string {
		return this.logFilePath;
	}
}

// Global logger registry to avoid creating multiple loggers for the same file
const loggerRegistry = new Map<string, AgentFileLogger>();

// Current active logger for tools to access
let currentActiveLogger: AgentFileLogger | null = null;

export function getAgentFileLogger(transcriptFilePath: string, fileId: string): AgentFileLogger {
	const key = `${fileId}-${transcriptFilePath}`;
	
	if (!loggerRegistry.has(key)) {
		loggerRegistry.set(key, new AgentFileLogger(transcriptFilePath, fileId));
	}
	
	const logger = loggerRegistry.get(key)!;
	currentActiveLogger = logger; // Set as active for tools
	return logger;
}

export function getCurrentLogger(): AgentFileLogger | null {
	return currentActiveLogger;
}

export function clearLoggerRegistry(): void {
	loggerRegistry.clear();
	currentActiveLogger = null;
}