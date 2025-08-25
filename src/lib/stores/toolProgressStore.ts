import { writable } from 'svelte/store';
import type { ToolProgress } from '$lib/agents/tools/toolMetadata';

interface ToolProgressState {
	[fileId: string]: {
		[segmentIndex: number]: ToolProgress[];
	};
}

function createToolProgressStore() {
	const { subscribe, set, update } = writable<ToolProgressState>({});

	return {
		subscribe,

		// Start tracking progress for a segment
		startProgress(fileId: string, segmentIndex: number, tools: ToolProgress[]) {
			update((state) => ({
				...state,
				[fileId]: {
					...state[fileId],
					[segmentIndex]: tools
				}
			}));
		},

		// Update a specific tool's progress
		updateToolProgress(
			fileId: string,
			segmentIndex: number,
			toolId: string,
			updates: Partial<ToolProgress>
		) {
			update((state) => {
				const fileState = state[fileId];
				if (!fileState || !fileState[segmentIndex]) return state;

				const tools = fileState[segmentIndex].map((tool) =>
					tool.toolId === toolId ? { ...tool, ...updates } : tool
				);

				return {
					...state,
					[fileId]: {
						...fileState,
						[segmentIndex]: tools
					}
				};
			});
		},

		// Clear progress for a segment
		clearProgress(fileId: string, segmentIndex: number) {
			update((state) => {
				const fileState = state[fileId];
				if (!fileState) return state;

				const { [segmentIndex]: _, ...rest } = fileState;
				return {
					...state,
					[fileId]: rest
				};
			});
		},

		// Get progress for a specific segment
		getProgress(fileId: string, segmentIndex: number): ToolProgress[] | undefined {
			let currentState: ToolProgressState;
			subscribe((state) => {
				currentState = state;
			})();
			return currentState?.[fileId]?.[segmentIndex];
		}
	};
}

export const toolProgressStore = createToolProgressStore();
