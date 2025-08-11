import { writable } from 'svelte/store';

export interface SelectedSegment {
  id: string;
  index: number;
  speakerName?: string;
  speakerTag?: string;
  text?: string;
  start: number;
  end: number;
  nodePosition?: number;  // Position in the ProseMirror document
}

function createSelectedSegmentStore() {
  const { subscribe, set, update } = writable<SelectedSegment | null>(null);

  return {
    subscribe,
    
    selectSegment(segment: SelectedSegment) {
      set(segment);
    },
    
    clearSelection() {
      set(null);
    },
    
    updateSegment(updates: Partial<SelectedSegment>) {
      update(segment => {
        if (!segment) return null;
        return { ...segment, ...updates };
      });
    }
  };
}

export const selectedSegmentStore = createSelectedSegmentStore();