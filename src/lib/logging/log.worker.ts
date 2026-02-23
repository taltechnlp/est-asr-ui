/// <reference lib="webworker" />

import type { IUserActionEvent } from '$lib/logging/types';

const MAX_BATCH_SIZE = 50; // Send events in batches of 50
const SYNC_INTERVAL = 5000; // Send events every 5 seconds

let pendingEvents: IUserActionEvent[] = [];
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Sends the current batch of events to the server.
 */
async function sendBatchToServer(): Promise<void> {
    if (pendingEvents.length === 0) {
        return;
    }

    const eventsToSend = [...pendingEvents]; // Copy the array
    pendingEvents = []; // Clear the pending events immediately

    console.log(`Worker: Sending batch of ${eventsToSend.length} events.`);
    try {
        const response = await fetch('/api/log-events', { // Use relative path from worker context
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ events: eventsToSend }),
        });

        if (!response.ok) {
            console.error(`Worker: API Error: ${response.status} ${response.statusText}`, await response.text());
            // Optional: Add events back to the queue for retry? Be careful about infinite loops.
            // pendingEvents = [...eventsToSend, ...pendingEvents];
        } else {
             console.log(`Worker: Successfully sent ${eventsToSend.length} events.`);
        }
    } catch (error) {
        console.error('Worker: Network or fetch error sending events:', error);
        // Optional: Add events back to the queue for retry?
        // pendingEvents = [...eventsToSend, ...pendingEvents];
    } finally {
        // Ensure the timeout is cleared after attempting a send
        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
        }
        // Schedule the next sync if there are still events (e.g., added during the fetch)
        scheduleSync();
    }
}

/**
 * Schedules the next sync operation if not already scheduled.
 */
function scheduleSync(): void {
    if (syncTimeout === null && pendingEvents.length > 0) {
        syncTimeout = setTimeout(sendBatchToServer, SYNC_INTERVAL);
    }
}

/**
 * Adds an event to the queue and triggers a send if the batch size is reached.
 */
function handleLogEvent(event: IUserActionEvent): void {
    pendingEvents.push(event);
    if (pendingEvents.length >= MAX_BATCH_SIZE) {
        console.log(`Worker: Batch size reached (${pendingEvents.length}). Sending immediately.`);
        // Clear existing timeout and send immediately
        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
        }
        sendBatchToServer();
    } else {
        // Ensure a sync is scheduled for the future if needed
        scheduleSync();
    }
}

// Listen for messages from the main thread
self.onmessage = (event: MessageEvent<{ type: string; event?: IUserActionEvent }>) => {
    const { type, event: eventData } = event.data;

    if (type === 'log' && eventData) {
        handleLogEvent(eventData);
    } else if (type === 'forceSync') {
        console.log("Worker: Received forceSync message.");
        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
        }
        sendBatchToServer(); // Send immediately regardless of batch size or interval
    }
};

console.log("Log worker started.");

// Optional: Add initial sync schedule if needed, though typically starts on first event
// scheduleSync();

// Optional: Handle worker termination gracefully
self.onclose = () => {
    console.log("Log worker closing. Attempting final sync.");
    if (pendingEvents.length > 0) {
       // Note: fetch might not complete reliably here in all browsers during close/unload.
       // Consider using navigator.sendBeacon if synchronous sending on close is critical.
       sendBatchToServer();
    }
}; 
