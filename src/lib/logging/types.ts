export type EventType =
	| 'input'
	| 'input_debounced'
	| 'selection'
	| 'paste'
	| 'click'
	| 'focus'
	| 'blur'
	| string;

export type EventStatus = 'pending' | 'synced' | 'error';

export interface IUserActionEvent {
	id?: number;
	fileId: string;
	timestamp: number;
	type: EventType;
	payload: Record<string, any> | unknown;
	status: EventStatus;
}
