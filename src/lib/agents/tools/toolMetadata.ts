export interface ToolMetadata {
  id: string;
  displayName: string;
  description: string;
  icon?: string;
  estimatedDuration?: string;
}

export const TOOL_METADATA: Record<string, ToolMetadata> = {
  'asr_nbest': {
    id: 'asr_nbest',
    displayName: 'Speech Recognition Analysis',
    description: 'Extracting alternative transcriptions using advanced speech recognition',
    icon: 'microphone',
    estimatedDuration: '5-10s'
  },
  'web_search': {
    id: 'web_search',
    displayName: 'Fact Checking',
    description: 'Verifying names and technical terms through web search',
    icon: 'search',
    estimatedDuration: '2-5s'
  },
  'llm_analysis': {
    id: 'llm_analysis',
    displayName: 'Language Analysis',
    description: 'Analyzing grammar, coherence, and context',
    icon: 'brain',
    estimatedDuration: '3-8s'
  },
  'enhanced_analysis': {
    id: 'enhanced_analysis',
    displayName: 'Enhanced Analysis',
    description: 'Combining speech recognition results with language analysis',
    icon: 'sparkles',
    estimatedDuration: '5-10s'
  },
  'position_mapping': {
    id: 'position_mapping',
    displayName: 'Position Tracking',
    description: 'Mapping text positions for accurate replacements',
    icon: 'target',
    estimatedDuration: '1s'
  }
};

export type ToolStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface ToolProgress {
  toolId: string;
  status: ToolStatus;
  startTime?: number;
  endTime?: number;
  error?: string;
  result?: any;
}