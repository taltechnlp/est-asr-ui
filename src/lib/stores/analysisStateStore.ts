import { writable, derived } from 'svelte/store';

export interface AnalysisState {
  fileId: string;
  isAnalyzing: boolean;
  analyzingSegmentIndex: number | null;
  analyzedSegments: Set<number>;
  error: string | null;
}

function createAnalysisStateStore() {
  const stores = new Map<string, ReturnType<typeof writable<AnalysisState>>>();
  
  function getOrCreateStore(fileId: string) {
    if (!stores.has(fileId)) {
      stores.set(fileId, writable<AnalysisState>({
        fileId,
        isAnalyzing: false,
        analyzingSegmentIndex: null,
        analyzedSegments: new Set(),
        error: null
      }));
    }
    return stores.get(fileId)!;
  }
  
  return {
    startAnalysis(fileId: string, segmentIndex: number) {
      const store = getOrCreateStore(fileId);
      store.update(state => ({
        ...state,
        isAnalyzing: true,
        analyzingSegmentIndex: segmentIndex,
        error: null
      }));
    },
    
    completeAnalysis(fileId: string, segmentIndex: number) {
      const store = getOrCreateStore(fileId);
      store.update(state => {
        const newAnalyzedSegments = new Set(state.analyzedSegments);
        newAnalyzedSegments.add(segmentIndex);
        return {
          ...state,
          isAnalyzing: false,
          analyzingSegmentIndex: null,
          analyzedSegments: newAnalyzedSegments,
          error: null
        };
      });
    },
    
    setError(fileId: string, error: string) {
      const store = getOrCreateStore(fileId);
      store.update(state => ({
        ...state,
        isAnalyzing: false,
        analyzingSegmentIndex: null,
        error
      }));
    },
    
    isSegmentAnalyzed(fileId: string, segmentIndex: number): boolean {
      const store = getOrCreateStore(fileId);
      let analyzed = false;
      store.subscribe(state => {
        analyzed = state.analyzedSegments.has(segmentIndex);
      })();
      return analyzed;
    },
    
    subscribe(fileId: string, callback: (state: AnalysisState) => void) {
      const store = getOrCreateStore(fileId);
      return store.subscribe(callback);
    },
    
    getState(fileId: string): AnalysisState {
      const store = getOrCreateStore(fileId);
      let currentState: AnalysisState = {
        fileId,
        isAnalyzing: false,
        analyzingSegmentIndex: null,
        analyzedSegments: new Set(),
        error: null
      };
      store.subscribe(state => {
        currentState = state;
      })();
      return currentState;
    },
    
    reset(fileId: string) {
      const store = getOrCreateStore(fileId);
      store.set({
        fileId,
        isAnalyzing: false,
        analyzingSegmentIndex: null,
        analyzedSegments: new Set(),
        error: null
      });
    }
  };
}

export const analysisStateStore = createAnalysisStateStore();