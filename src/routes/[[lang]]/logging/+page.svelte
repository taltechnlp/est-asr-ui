<script lang="ts">
    import { logEvent } from '$lib/logging/events';
    import type { EventType } from '$lib/db/client'; // Import from the correct location
    import { onMount } from 'svelte';

    let editorContent: string = '';
    // Add a fileId for logging purposes - could be a prop or generated
    const loggingFileId = 'editor-session-' + Date.now(); // Generate a unique ID for this session

    // Example handler with explicit event type
    function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
        editorContent = event.currentTarget.value;
        // Log the raw input event - add fileId as second parameter
        // Use the EventType for type safety
        logEvent('input' as EventType, loggingFileId, {
             value: editorContent,
             selectionStart: event.currentTarget.selectionStart,
             selectionEnd: event.currentTarget.selectionEnd
        });
        
        // Call the debounced function with the current value, not the event
        debouncedLogInput(editorContent);
    }

    function handleSelection(event: Event & { currentTarget: HTMLTextAreaElement }) {
         logEvent('selection' as EventType, loggingFileId, {
             start: event.currentTarget.selectionStart,
             end: event.currentTarget.selectionEnd
        });
    }

    // Update debounce to work with any type
    function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
         let timeout: ReturnType<typeof setTimeout> | null = null;
         return function executedFunction(...args: Parameters<T>): void {
             const later = () => {
                 timeout = null;
                 func(...args);
             };
             if (timeout !== null) {
                clearTimeout(timeout);
             }
             timeout = setTimeout(later, wait);
         };
    }

    // Change to accept a string value instead of an event
    const debouncedLogInput = debounce((value: string) => {
         logEvent('input_debounced' as EventType, loggingFileId, { value });
    }, 500);

    onMount(() => {
        // Component setup
    });
</script>

<textarea
    bind:value={editorContent}
    on:input={handleInput}
    on:select={handleSelection}
    placeholder="Start typing..."
></textarea>