import { writable } from 'svelte/store';
import type { TranscriptSummary } from '@prisma/client';

interface SummaryState {
  [fileId: string]: {
    loading: boolean;
    checked: boolean;
    exists: boolean;
    summary: TranscriptSummary | null;
    error?: string;
  };
}

function createSummaryStore() {
  const { subscribe, update } = writable<SummaryState>({});

  return {
    subscribe,
    
    async checkAndLoad(fileId: string): Promise<TranscriptSummary | null> {
      // Check if we already have the state for this file
      let currentState: SummaryState = {};
      update(state => {
        currentState = state;
        return state;
      });

      // If already checked and loaded, return cached result
      if (currentState[fileId]?.checked && !currentState[fileId]?.loading) {
        return currentState[fileId].summary;
      }

      // If currently loading, wait a bit and check again
      if (currentState[fileId]?.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.checkAndLoad(fileId);
      }

      // Mark as loading
      update(state => ({
        ...state,
        [fileId]: { ...state[fileId], loading: true, checked: false }
      }));

      try {
        // Check if summary exists
        const checkResponse = await fetch(`/api/transcript-summary/${fileId}/exists`);
        if (!checkResponse.ok) {
          update(state => ({
            ...state,
            [fileId]: { 
              loading: false, 
              checked: true, 
              exists: false, 
              summary: null,
              error: 'Failed to check summary'
            }
          }));
          return null;
        }

        const { exists } = await checkResponse.json();
        
        if (!exists) {
          // Summary doesn't exist
          update(state => ({
            ...state,
            [fileId]: { 
              loading: false, 
              checked: true, 
              exists: false, 
              summary: null 
            }
          }));
          return null;
        }

        // Summary exists, fetch it
        const response = await fetch(`/api/transcript-summary/${fileId}`);
        if (response.ok) {
          const summary = await response.json();
          update(state => ({
            ...state,
            [fileId]: { 
              loading: false, 
              checked: true, 
              exists: true, 
              summary 
            }
          }));
          return summary;
        } else {
          update(state => ({
            ...state,
            [fileId]: { 
              loading: false, 
              checked: true, 
              exists: false, 
              summary: null,
              error: `Failed to load summary: ${response.statusText}`
            }
          }));
          return null;
        }
      } catch (err) {
        update(state => ({
          ...state,
          [fileId]: { 
            loading: false, 
            checked: true, 
            exists: false, 
            summary: null,
            error: err instanceof Error ? err.message : 'Unknown error'
          }
        }));
        return null;
      }
    },

    // Force refresh a summary
    async refresh(fileId: string): Promise<TranscriptSummary | null> {
      update(state => {
        const newState = { ...state };
        delete newState[fileId];
        return newState;
      });
      return this.checkAndLoad(fileId);
    },

    // Update summary after generation
    setSummary(fileId: string, summary: TranscriptSummary) {
      update(state => ({
        ...state,
        [fileId]: {
          loading: false,
          checked: true,
          exists: true,
          summary
        }
      }));
    }
  };
}

export const summaryStore = createSummaryStore();