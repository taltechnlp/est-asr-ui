<script lang="ts">
  import { onMount } from 'svelte';
  import SummaryAccordion from '$lib/components/transcript-summary/SummaryAccordion.svelte';
  import SegmentControl from '$lib/components/transcript-analysis/SegmentControl.svelte';
  import type { TranscriptSummary } from '@prisma/client';
  
  // Mock data for testing
  const mockFileId = 'test-file-123';
  const mockEditorContent = {
    type: 'doc',
    content: [
      {
        type: 'speaker',
        attrs: { 'data-name': 'Speaker 1', id: 'speaker1' },
        content: [
          {
            type: 'text',
            text: 'This is a test transcript for demonstrating the agent functionality.',
            marks: [{ type: 'word', attrs: { start: 0, end: 2, id: 'w1' } }]
          }
        ]
      },
      {
        type: 'speaker',
        attrs: { 'data-name': 'Speaker 2', id: 'speaker2' },
        content: [
          {
            type: 'text',
            text: 'We can analyze this transcript in segments and generate summaries.',
            marks: [{ type: 'word', attrs: { start: 3, end: 5, id: 'w2' } }]
          }
        ]
      }
    ]
  };
  
  let summary = $state<TranscriptSummary | null>(null);
  
  function handleSummaryGenerated(newSummary: TranscriptSummary) {
    summary = newSummary;
    console.log('Summary generated:', newSummary);
  }
  
  function handleSegmentAnalyzed(result: any) {
    console.log('Segment analyzed:', result);
  }
</script>

<div class="container mx-auto p-4 max-w-4xl">
  <h1 class="text-2xl font-bold mb-4">Transcript Analysis Agent Test</h1>
  
  <div class="mb-8">
    <h2 class="text-xl font-semibold mb-2">Summary Generation</h2>
    <p class="text-gray-600 mb-4">
      This demonstrates the summary generation feature. Click "Generate Summary" to create an AI-powered summary of the transcript.
    </p>
    <SummaryAccordion
      fileId={mockFileId}
      onSummaryGenerated={handleSummaryGenerated}
    />
  </div>
  
  <div class="mb-8">
    <h2 class="text-xl font-semibold mb-2">Segment Analysis</h2>
    <p class="text-gray-600 mb-4">
      This demonstrates the segment-by-segment analysis. The transcript is divided into 200-word segments that can be analyzed individually.
    </p>
    <SegmentControl
      fileId={mockFileId}
      editorContent={mockEditorContent}
      audioFilePath="/path/to/mock/audio.mp3"
      {summary}
      onSegmentAnalyzed={handleSegmentAnalyzed}
    />
  </div>
  
  <div class="bg-blue-50 p-4 rounded-lg">
    <h3 class="font-semibold mb-2">How it works:</h3>
    <ol class="list-decimal list-inside space-y-2">
      <li>First, generate a summary of the entire transcript</li>
      <li>The summary provides context for segment analysis</li>
      <li>Navigate through segments and analyze each one</li>
      <li>The agent can use ASR N-best alternatives for low-confidence segments</li>
      <li>Web search is available for verifying terms and concepts</li>
    </ol>
  </div>
</div>

<style>
  .container {
    min-height: 100vh;
  }
</style>