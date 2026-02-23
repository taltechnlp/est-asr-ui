// --- Event Logging ---

import { db } from '$lib/logging/db';
import type { EventStatus, IUserActionEvent } from '$lib/logging/types';
import { browser } from '$app/environment'; // Use SvelteKit's environment detection

let worker: Worker | null = null;

// Initialize the worker only in the browser context
if (browser) {
	// Use the { type: 'module' } option if your worker uses ES modules
	// Ensure your build setup (e.g., Vite) handles worker bundling correctly.
	worker = new Worker(new URL('./log.worker.ts', import.meta.url), { type: 'module' });

	worker.onmessage = (event) => {
		// Optional: Handle messages *from* the worker if needed
		console.log('Main thread received message from worker:', event.data);
	};

	worker.onerror = (error) => {
		console.error('Error in log worker:', error.message, error);
		// Handle worker errors (e.g., stop trying to use it)
		worker = null;
	};

	// Optional: Send a final sync message when the page is closing.
	// Note: 'beforeunload' and 'unload' reliability varies. sendBeacon in the worker
	// might be more robust for critical final syncs.
	// window.addEventListener('beforeunload', () => {
	//     if (worker) {
	//         console.log("Main: Sending forceSync on beforeunload");
	//         worker.postMessage({ type: 'forceSync' });
	//     }
	// });
} else {
	console.warn('Logging disabled: Not running in a browser environment.');
}

/**
 * Logs a user action event by sending it to the logging web worker.
 * Does nothing if not in a browser environment or if the worker failed to initialize.
 *
 * @param type The type of the event (e.g., 'click', 'input_change').
 * @param targetId An identifier for the element or context related to the event.
 * @param data Additional data associated with the event.
 */
export function logEvent(type: string, targetId: string, data?: Record<string, any>): void {
	if (!worker) {
		// Silently fail or log a warning if the worker isn't available
		// console.warn('Log worker not available. Event not logged:', type, targetId);
		return;
	}

	const eventData: IUserActionEvent = {
		timestamp: Date.now(),
		type,
		fileId: targetId,
		// session_id: getSessionId(), // Add session ID if applicable
		// user_id: getUserId(),       // Add user ID if applicable
		payload: data ?? {}, // Ensure data is always an object
		status: 'pending' as EventStatus
	};

	// Send the event data to the worker
	worker.postMessage({ type: 'log', event: eventData });
}

/**
 * Manually triggers the worker to send any pending events immediately.
 * Useful for specific scenarios like before navigating away (though reliability varies).
 */
export function forceSyncEvents(): void {
	if (!worker) {
		console.warn('Log worker not available. Cannot force sync.');
		return;
	}
	console.log('Main: Posting forceSync message to worker.');
	worker.postMessage({ type: 'forceSync' });
}

// The original syncEvents function is removed as the worker now handles periodic syncing.
// export async function syncEvents(): Promise<void> { ... } // REMOVED

// --- Batching and Syncing ---

const SYNC_BATCH_SIZE = 50;
let isSyncing = false;

/**
 * Retrieves a batch of pending events from the database.
 * @returns A promise resolving to an array of event objects.
 */
async function getEventsBatch(): Promise<IUserActionEvent[]> {
	try {
		const events: IUserActionEvent[] = await db.pendingEvents
			.where('status')
			.equals('pending' as EventStatus) // Explicitly type string literal
			.limit(SYNC_BATCH_SIZE)
			.toArray();
		return events;
	} catch (error) {
		console.error('Dexie (TS): Failed to get event batch:', error);
		return []; // Return empty array on error
	}
}

/**
 * Deletes successfully synced events from the local database by their IDs.
 * @param ids - An array of event IDs to delete.
 */
async function deleteSyncedEvents(ids: number[]): Promise<void> {
	if (!ids || ids.length === 0) return;
	try {
		await db.pendingEvents.bulkDelete(ids);
		console.log(`Dexie (TS): Deleted ${ids.length} synced events.`);
	} catch (error) {
		console.error('Dexie (TS): Failed to delete synced events:', error);
		// How to handle failure? Could lead to duplicate sends. Maybe mark as 'error'?
		// Example: await db.pendingEvents.where('id').anyOf(ids).modify({ status: 'error' });
	}
}

// --- Initialization ---

function initializeEventLogger(): void {
	// Use a small delay to allow the app to initialize fully and avoid potential SSR issues
	if (typeof window !== 'undefined') {
		// Ensure this runs only client-side
		// Remove this event listener that calls syncEvents
		// document.addEventListener('visibilitychange', () => {
		//     if (document.visibilityState === 'visible') {
		//         syncEvents();
		//     }
		// });

		console.log('Event logger initialized with Dexie (TS).');

		// Explicitly open the database to catch early errors if needed.
		db.open().catch((err) => {
			console.error('Failed to open Dexie DB:', err);
		});
	}
}

// Call initialization logic
initializeEventLogger();
