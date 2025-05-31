import { PrismaClient } from '@prisma/client';
import Dexie, { type Table } from 'dexie';

export const prisma = new PrismaClient();

export type EventType =
    | 'input'
    | 'input_debounced'
    | 'selection'
    | 'paste'
    | 'click'
    | 'focus'
    | 'blur'
    // Add other specific event types as needed
    | string; // Allow custom string types

export type EventStatus = 'pending' | 'synced' | 'error';

// Interface defining the structure of an event object stored in Dexie
export interface IUserActionEvent {
    id?: number; // Optional: Primary key, auto-incremented by Dexie
    fileId: string;
    timestamp: number; // Milliseconds since epoch (Date.now())
    type: EventType;
    // Use a flexible payload; adjust if you have a more constrained structure
    payload: Record<string, any> | unknown;
    status: EventStatus;
}

// --- Dexie Database Class Definition ---

export class UserActionsDB extends Dexie {
    // Declare table property with types: IUserActionEvent = data structure, number = primary key type (id)
    pendingEvents!: Table<IUserActionEvent, number>;

    constructor() {
        super('userActionsDB'); // Database name
        this.version(1).stores({
            // Schema definition: '++id' = auto-incrementing primary key 'id'
            // 'status' = index on the status property
            pendingEvents: '++id, status'
        });
        // You could map 'pendingEvents' to a specific class here if needed,
        // but for simple data objects, the interface mapping is often sufficient.
        // this.pendingEvents.mapToClass(UserActionEventClass);
    }
}

// --- Instantiate and Export Database ---

export const db = new UserActionsDB();


