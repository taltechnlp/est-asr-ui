import Dexie, { type Table } from 'dexie';
import type { IUserActionEvent } from '$lib/logging/types';

export class UserActionsDB extends Dexie {
	pendingEvents!: Table<IUserActionEvent, number>;

	constructor() {
		super('userActionsDB');
		this.version(1).stores({
			pendingEvents: '++id, status'
		});
	}
}

export const db = new UserActionsDB();
