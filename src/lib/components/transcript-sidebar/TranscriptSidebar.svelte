<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TranscriptSummary } from '@prisma/client';
  import type { TipTapEditorContent } from '../../../types';
  import Icon from 'svelte-awesome/components/Icon.svelte';
  import chevronLeft from 'svelte-awesome/icons/chevronLeft';
  import chevronRight from 'svelte-awesome/icons/chevronRight';
  import user from 'svelte-awesome/icons/user';
  import clockO from 'svelte-awesome/icons/clockO';
  import flask from 'svelte-awesome/icons/flask';
  import spinner from 'svelte-awesome/icons/spinner';
  import check from 'svelte-awesome/icons/check';
  import refresh from 'svelte-awesome/icons/refresh';
  import exclamationTriangle from 'svelte-awesome/icons/exclamationTriangle';
  import wrench from 'svelte-awesome/icons/wrench';
  import SegmentControlPosition from '../transcript-analysis/SegmentControlPosition.svelte';
  import ToolProgressDisplay from '../transcript-analysis/ToolProgressDisplay.svelte';
  import { _, locale } from 'svelte-i18n';
  import { selectedSegmentStore } from '$lib/stores/selectedSegmentStore';
  import { analysisStateStore } from '$lib/stores/analysisStateStore';
  import { normalizeLanguageCode } from '$lib/utils/language';
  import { editor as editorStore } from '$lib/stores.svelte';
  import { getReconciliationService } from '$lib/services/editReconciliation';
  import { getPositionMapper } from '$lib/services/positionMapper';
  import type { ToolProgress } from '$lib/agents/tools/toolMetadata';
  // Use AI version if we're in the AI editor (check by looking for Word nodes)
  import { extractSpeakerSegments as extractSpeakerSegmentsOriginal } from '$lib/utils/extractWordsFromEditor';
  import { extractSpeakerSegments as extractSpeakerSegmentsAI } from '$lib/utils/extractWordsFromEditorAI';
  
  let {
    fileId = '',
    editorContent = null as TipTapEditorContent | null,
    audioFilePath = '',
    summary = null as TranscriptSummary | null,
    onSegmentAnalyzed = (result: any) => {},
    collapsed = false,
    onCollapsedChange = (value: boolean) => {}
  } = $props();

  let selectedSegment = $state<any>(null);
  let segmentText = $state('');
  let segmentAnalysisResult = $state<any>(null);
  let isReanalyzing = $state(false);
  let applyingStates = $state<Record<number, boolean>>({});
  let documentVersionAtAnalysis = $state<any>(null);
  let documentStateAtAnalysis = $state<any>(null);
  let segmentAbsolutePosition = $state<number | null>(null);
  let reconciliationService = $state<any>(null);
  let toolProgress = $state<ToolProgress[]>([]);
  
  // Subscribe to shared analysis state
  let analysisState = $state<any>(null);
  let isAnalyzing = $derived(
    analysisState?.isAnalyzing && 
    selectedSegment && 
    analysisState?.analyzingSegmentIndex === selectedSegment.index
  );
  
  // Subscribe to selected segment changes
  const unsubscribe = selectedSegmentStore.subscribe(async segment => {
    selectedSegment = segment;
    if (segment) {
      // Extract segment text from the editor content
      extractSegmentText(segment);
      
      // Clear previous analysis when selecting new segment
      segmentAnalysisResult = null;
      
      // Check if there's an existing analysis for this segment
      try {
        const response = await fetch(`/api/transcript-analysis/segments/${fileId}/`);
        if (response.ok) {
          const segments = await response.json();
          const existingAnalysis = segments.find((s: any) => 
            s.segmentIndex === segment.index
          );
          
          if (existingAnalysis) {
            // Parse suggestions if they're a string
            if (typeof existingAnalysis.suggestions === 'string') {
              try {
                existingAnalysis.suggestions = JSON.parse(existingAnalysis.suggestions);
              } catch (e) {
                console.error('Failed to parse existing suggestions:', e);
                existingAnalysis.suggestions = [];
              }
            }
            
            segmentAnalysisResult = existingAnalysis;
            console.log('Loaded existing analysis:', existingAnalysis);
            
            // Calculate segment position before applying suggestions
            await calculateSegmentPosition();
            
            // Map positions for loaded analysis (same as we do for fresh analysis)
            if ($editorStore && segmentAnalysisResult.suggestions) {
              console.log('Mapping positions for loaded analysis suggestions...');
              segmentAnalysisResult.suggestions = segmentAnalysisResult.suggestions.map((suggestion: any) => {
                // If the suggestion has segment-relative positions AND we know where the segment is
                if (suggestion.from !== undefined && suggestion.to !== undefined && segmentAbsolutePosition !== null) {
                  // Convert to absolute positions
                  const absoluteFrom = segmentAbsolutePosition + suggestion.from;
                  const absoluteTo = segmentAbsolutePosition + suggestion.to;
                  
                  console.log(`Converting positions for "${suggestion.originalText}": segment [${suggestion.from}, ${suggestion.to}] → absolute [${absoluteFrom}, ${absoluteTo}]`);
                  
                  // Update suggestion with absolute positions
                  suggestion.from = absoluteFrom;
                  suggestion.to = absoluteTo;
                  console.log(`Updated suggestion positions to: [${suggestion.from}, ${suggestion.to}]`);
                }
                return suggestion;
              });
            }
            
            // Auto-apply suggestions for existing analysis if not already applied
            await applyAutoSuggestions(existingAnalysis);
          }
        }
      } catch (error) {
        console.error('Failed to check for existing analysis:', error);
      }
    }
  });
  
  // Function to calculate segment position in the document
  async function calculateSegmentPosition() {
    const editor = $editorStore;
    if (!editor || !selectedSegment) {
      segmentAbsolutePosition = null;
      return;
    }
    
    const doc = editor.state.doc;
    
    // Extract the segment text
    extractSegmentText(selectedSegment);
    
    console.log(`Calculating position for segment ${selectedSegment.index} with text: "${segmentText?.substring(0, 50) || ''}..."`);
    
    // Find all speaker nodes
    const speakerNodes = [];
    doc.nodesBetween(0, doc.content.size, (node, pos) => {
      if (node.type.name === 'speaker') {
        speakerNodes.push({ node, pos });
      }
    });
    
    if (speakerNodes[selectedSegment.index]) {
      const targetSpeakerNode = speakerNodes[selectedSegment.index];
      const actualText = targetSpeakerNode.node.textContent;
      console.log(`🔍 Speaker node ${selectedSegment.index} actual text: "${actualText.substring(0, 100)}..."`);
      
      // Find the actual text content position within the speaker node
      let contentStartPos = targetSpeakerNode.pos + 1; // Start after the speaker node opening
      
      // Traverse the speaker node to find where the actual text content begins
      let foundContentStart = false;
      targetSpeakerNode.node.nodesBetween(0, targetSpeakerNode.node.content.size, (node, relPos) => {
        if (!foundContentStart && (node.isText || node.type.name === 'wordNode')) {
          // Found the first text or word node - this is where content starts
          contentStartPos = targetSpeakerNode.pos + 1 + relPos;
          foundContentStart = true;
          return false; // Stop searching
        }
      });
      
      segmentAbsolutePosition = contentStartPos;
      console.log(`📍 Found segment ${selectedSegment.index} content at position: ${segmentAbsolutePosition}`);
      
      // Debug: Check what text is actually at this position
      try {
        const testText = doc.textBetween(
          segmentAbsolutePosition,
          Math.min(segmentAbsolutePosition + 50, doc.content.size),
          '',
          ''
        );
        console.log(`📍 Text at calculated position ${segmentAbsolutePosition}: "${testText}..."`);
      } catch (e) {
        console.error('Could not verify text at position:', e);
      }
    } else {
      console.warn(`Could not find speaker node at index ${selectedSegment.index}. Total speaker nodes: ${speakerNodes.length}`);
      segmentAbsolutePosition = null;
    }
    
    // Initialize reconciliation service if needed
    if (!reconciliationService && editor) {
      reconciliationService = getReconciliationService(editor);
    }
  }
  
  function extractSegmentText(segment: any) {
    if (!editorContent || !editorContent.content) {
      segmentText = '';
      return;
    }
    
    // The most reliable way is to use the index since segment IDs might not match
    let node = null;
    
    // First try to get by index (most reliable for SegmentControl segments)
    if (segment.index !== undefined && segment.index >= 0) {
      const speakerNodes = editorContent.content.filter((n: any) => 
        n.type === 'speaker'
      );
      if (speakerNodes[segment.index]) {
        node = speakerNodes[segment.index];
      }
    }
    
    // Fallback: try by speaker name and index
    if (!node && segment.speakerName) {
      const speakerNodes = editorContent.content.filter((n: any) => 
        n.attrs && n.attrs['data-name'] === segment.speakerName
      );
      if (speakerNodes.length > 0) {
        // Use index if available, otherwise use first match
        const relativeIndex = segment.index !== undefined ? 
          speakerNodes.findIndex((n: any, i: number) => i === segment.index) : 0;
        node = speakerNodes[relativeIndex >= 0 ? relativeIndex : 0];
      }
    }
    
    if (node && node.content) {
      // Extract text from the node (handles both text nodes and Word nodes)
      let extractedText = '';
      node.content.forEach((n: any) => {
        if (n.type === 'text') {
          // Plain text node (spaces, etc.)
          extractedText += n.text || '';
        } else if (n.type === 'wordNode') {
          // Word node - extract text from its content
          if (n.content && n.content.length > 0) {
            n.content.forEach((child: any) => {
              if (child.type === 'text') {
                extractedText += child.text || '';
              }
            });
          }
        }
      });
      segmentText = extractedText.trim();
    } else {
      segmentText = segment.text || '';
    }
  }
  
  // Helper function to find text near a position
  function findTextNearPosition(doc: any, searchText: string, nearPos: number, radius: number = 100): { from: number; to: number } | null {
    const start = Math.max(0, nearPos - radius);
    const end = Math.min(doc.content.size, nearPos + radius);
    
    try {
      const searchArea = doc.textBetween(start, end, ' ');
      const normalizedSearch = searchText.toLowerCase().trim();
      const normalizedArea = searchArea.toLowerCase();
      
      const index = normalizedArea.indexOf(normalizedSearch);
      if (index !== -1) {
        const foundFrom = start + index;
        const foundTo = foundFrom + searchText.length;
        
        // Verify the found text
        const foundText = doc.textBetween(foundFrom, foundTo);
        if (foundText.toLowerCase().trim() === normalizedSearch) {
          return { from: foundFrom, to: foundTo };
        }
      }
    } catch (e) {
      console.error('Error in findTextNearPosition:', e);
    }
    
    return null;
  }
  
  function toggleCollapsed() {
    const newValue = !collapsed;
    collapsed = newValue;
    onCollapsedChange(newValue);
  }
  
  function formatDuration(start: number, end: number): string {
    if (start < 0 || end < 0) return '';
    const duration = end - start;
    const seconds = Math.floor(duration);
    const ms = Math.floor((duration - seconds) * 1000);
    return `${seconds}.${ms.toString().padStart(3, '0')}s`;
  }
  
  function formatTimestamp(time: number): string {
    if (time < 0) return '';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  async function analyzeSelectedSegment() {
    if (!selectedSegment || !summary) return;
    
    // Check if already analyzing
    if (analysisState?.isAnalyzing) {
      return;
    }
    
    // Extract all speaker segments from editor content for position tracking
    let extractedSegments = [];
    if (editorContent) {
      try {
        // Check if document has Word nodes (AI editor) or word marks (original editor)
        const hasWordNodes = editorContent.content?.some((node: any) => 
          node.content?.some((child: any) => child.type === 'wordNode')
        );
        
        // Use appropriate extractor based on document structure
        const extractSpeakerSegments = hasWordNodes ? extractSpeakerSegmentsAI : extractSpeakerSegmentsOriginal;
        extractedSegments = extractSpeakerSegments(editorContent);
      } catch (e) {
        console.error('Failed to extract segments:', e);
      }
    }
    
    // Store document version and state at analysis time
    const editor = $editorStore;
    if (editor) {
      const mapper = getPositionMapper(editor);
      documentVersionAtAnalysis = mapper.getVersion();
      documentStateAtAnalysis = editor.state.doc;
      
      // Calculate the segment position
      await calculateSegmentPosition();
    }
    
    // Set shared state to analyzing
    analysisStateStore.startAnalysis(fileId, selectedSegment.index);
    
    // Initialize tool progress
    toolProgress = [
      { toolId: 'llm_analysis', status: 'running', startTime: Date.now() },
      { toolId: 'asr_nbest', status: 'pending' },
      { toolId: 'enhanced_analysis', status: 'pending' }
    ];
    
    try {
      // Create segment object with required fields - use the actual segment text
      const segment = {
        index: selectedSegment.index || 0,
        startTime: typeof selectedSegment.start === 'number' ? selectedSegment.start : 0,
        endTime: typeof selectedSegment.end === 'number' ? selectedSegment.end : 0,
        startWord: 0,  // Required field
        endWord: 0,    // Required field
        text: segmentText || selectedSegment.text || '',  // Use the actual text from the selected segment
        speakerTag: selectedSegment.speakerTag || selectedSegment.speakerName || 'Speaker',
        speakerName: selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker',
        words: []
      };
      
      console.log('Sending segment to API:', segment);
      console.log('Selected segment info:', {
        index: selectedSegment.index,
        text: segmentText.substring(0, 100),
        speakerName: selectedSegment.speakerName
      });
      
      // Simulate tool progress updates after initial delay
      setTimeout(() => {
        if (isAnalyzing) {
          toolProgress = [
            { toolId: 'llm_analysis', status: 'completed', startTime: toolProgress[0].startTime, endTime: Date.now() },
            { toolId: 'asr_nbest', status: 'running', startTime: Date.now() },
            { toolId: 'enhanced_analysis', status: 'pending' }
          ];
        }
      }, 3000);
      
      setTimeout(() => {
        if (isAnalyzing) {
          toolProgress = [
            { toolId: 'llm_analysis', status: 'completed', startTime: toolProgress[0].startTime, endTime: toolProgress[0].endTime },
            { toolId: 'asr_nbest', status: 'completed', startTime: toolProgress[1].startTime, endTime: Date.now() },
            { toolId: 'enhanced_analysis', status: 'running', startTime: Date.now() }
          ];
        }
      }, 8000);
      
      // Call the same endpoint as the popup component
      const currentLocale = normalizeLanguageCode($locale);
      const response = await fetch('/api/transcript-analysis/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          segment,
          summaryId: summary.id,
          audioFilePath,
          uiLanguage: currentLocale,
          usePositions: true,  // Enable position-based analysis
          extractedSegments,   // Pass extracted segments for position mapping
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      // Handle the response structure
      if (result.analysisSegment) {
        // The analysisSegment from database has suggestions as a JSON string
        const dbRecord = result.analysisSegment;
        
        // Parse suggestions if they're a string
        if (typeof dbRecord.suggestions === 'string') {
          try {
            dbRecord.suggestions = JSON.parse(dbRecord.suggestions);
          } catch (e) {
            console.error('Failed to parse suggestions:', e);
            dbRecord.suggestions = [];
          }
        }
        
        segmentAnalysisResult = dbRecord;
      } else if (result.suggestions) {
        // Direct suggestions in result - ensure they're parsed if needed
        if (typeof result.suggestions === 'string') {
          try {
            result.suggestions = JSON.parse(result.suggestions);
          } catch (e) {
            console.error('Failed to parse suggestions:', e);
            result.suggestions = [];
          }
        }
        segmentAnalysisResult = result;
      } else {
        console.warn('Unexpected response structure:', result);
        segmentAnalysisResult = result;
      }
      
      
      // Check if suggestions have shouldAutoApply flag
      if (segmentAnalysisResult?.suggestions && Array.isArray(segmentAnalysisResult.suggestions)) {
        const autoApplyCount = segmentAnalysisResult.suggestions.filter((s: any) => s.shouldAutoApply).length;
        console.log(`Found ${autoApplyCount} suggestions marked for auto-apply out of ${segmentAnalysisResult.suggestions.length} total`);
        
        // Map suggestion positions from segment-relative to absolute, then through the PositionMapper
        const editor = $editorStore;
        if (editor) {
          const mapper = getPositionMapper(editor);
          
          // Check if we have a valid segment position
          if (segmentAbsolutePosition === null) {
            console.warn('No segment absolute position found, positions will not be available for suggestions');
          }
          
          segmentAnalysisResult.suggestions = segmentAnalysisResult.suggestions.map((suggestion: any) => {
            // If the suggestion has segment-relative positions AND we know where the segment is
            if (suggestion.from !== undefined && suggestion.to !== undefined && segmentAbsolutePosition !== null) {
              // Convert to absolute positions
              const absoluteFrom = segmentAbsolutePosition + suggestion.from;
              const absoluteTo = segmentAbsolutePosition + suggestion.to;
              
              console.log(`Converting positions for "${suggestion.originalText}": segment [${suggestion.from}, ${suggestion.to}] → absolute [${absoluteFrom}, ${absoluteTo}]`);
              console.log(`Segment absolute position: ${segmentAbsolutePosition}, analyzing segment index: ${selectedSegment?.index}`);
              
              // Verify the text at the calculated position matches what we expect
              try {
                const textAtPosition = editor.state.doc.textBetween(
                  Math.max(0, absoluteFrom),
                  Math.min(editor.state.doc.content.size, absoluteTo),
                  ''
                );
                
                if (textAtPosition.toLowerCase() !== suggestion.originalText.toLowerCase()) {
                  console.warn(`Text mismatch at calculated position [${absoluteFrom}, ${absoluteTo}]:`);
                  console.warn(`  Expected: "${suggestion.originalText}"`);
                  console.warn(`  Found: "${textAtPosition}"`);
                  console.warn(`  Will fall back to text search...`);
                  // Clear positions to trigger text search fallback
                  suggestion.from = undefined;
                  suggestion.to = undefined;
                  return suggestion;
                }
              } catch (e) {
                console.error('Error verifying text at position:', e);
                // Clear positions to trigger text search fallback
                suggestion.from = undefined;
                suggestion.to = undefined;
                return suggestion;
              }
              
              // Map through any transactions that happened since analysis started
              const mappedRange = mapper.mapRange(absoluteFrom, absoluteTo);
              
              if (mappedRange.valid) {
                // Update suggestion with mapped positions
                suggestion.from = mappedRange.from.mapped;
                suggestion.to = mappedRange.to.mapped;
                console.log(`Mapped to current positions: [${suggestion.from}, ${suggestion.to}]`);
                
                // Verify the text is still there
                const currentText = editor.state.doc.textBetween(suggestion.from, suggestion.to, '');
                if (currentText.toLowerCase() !== suggestion.originalText.toLowerCase()) {
                  console.warn(`Text at mapped position has changed: expected "${suggestion.originalText}", found "${currentText}"`);
                  // Try recovery by text search in a small radius
                  const recovered = findTextNearPosition(editor.state.doc, suggestion.originalText, suggestion.from, 100);
                  if (recovered) {
                    suggestion.from = recovered.from;
                    suggestion.to = recovered.to;
                    console.log(`Recovered position by text search: [${suggestion.from}, ${suggestion.to}]`);
                  } else {
                    // Clear positions to fall back to text search
                    delete suggestion.from;
                    delete suggestion.to;
                    console.log(`Could not recover position, will use text search`);
                  }
                }
              } else {
                console.warn(`Position mapping invalid for "${suggestion.originalText}", will use text search`);
                // Clear positions to fall back to text search
                delete suggestion.from;
                delete suggestion.to;
              }
            }
            
            return suggestion;
          });
        }
      }
      
      // Reset applying states when we get new results
      applyingStates = {};
      
      // Mark as completed in shared state
      analysisStateStore.completeAnalysis(fileId, selectedSegment.index);
      onSegmentAnalyzed(segmentAnalysisResult);
      
      // Update tool progress to show all completed
      toolProgress = [
        { toolId: 'llm_analysis', status: 'completed', startTime: toolProgress[0].startTime, endTime: toolProgress[0].endTime || Date.now() },
        { toolId: 'asr_nbest', status: 'completed', startTime: toolProgress[1].startTime || Date.now() - 5000, endTime: toolProgress[1].endTime || Date.now() - 2000 },
        { toolId: 'enhanced_analysis', status: 'completed', startTime: toolProgress[2].startTime || Date.now() - 2000, endTime: Date.now() }
      ];
      
      // Automatically apply suggestions marked with shouldAutoApply
      await applyAutoSuggestions(segmentAnalysisResult);
    } catch (err) {
      console.error('Segment analysis error:', err);
      analysisStateStore.setError(fileId, err instanceof Error ? err.message : 'Analysis failed');
      
      // Update tool progress to show error
      const currentTool = toolProgress.find(t => t.status === 'running');
      if (currentTool) {
        toolProgress = toolProgress.map(t => 
          t.toolId === currentTool.toolId 
            ? { ...t, status: 'error', endTime: Date.now(), error: 'Analysis failed' }
            : t.status === 'pending' 
              ? { ...t, status: 'skipped' }
              : t
        );
      }
    }
  }
  
  async function applyAutoSuggestions(analysisResult: any) {
    if (!analysisResult?.suggestions || !Array.isArray(analysisResult.suggestions)) {
      return;
    }
    
    const autoApplySuggestions = analysisResult.suggestions.filter(
      (s: any) => s.shouldAutoApply && !s.applied && s.originalText && s.suggestedText
    );
    
    if (autoApplySuggestions.length === 0) {
      console.log('No suggestions marked for auto-apply');
      return;
    }
    
    console.group(`🤖 Auto-applying ${autoApplySuggestions.length} suggestions as diff nodes`);
    
    for (const suggestion of autoApplySuggestions) {
      try {
        console.log(`Creating diff: "${suggestion.originalText}" → "${suggestion.suggestedText}"`);
        
        // Dispatch event to create diff node in the editor
        const event = new CustomEvent('applyTranscriptSuggestionAsDiff', {
          detail: {
            suggestion,
            segmentId: selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker',
            callback: (result: any) => {
              if (result.success) {
                console.log(`✅ Diff created: ${result.diffId}`);
                // Update the suggestion to mark it as having a diff created
                suggestion.diffCreated = true;
                suggestion.diffId = result.diffId;
              } else {
                console.error(`❌ Failed to create diff: ${result.error}`);
              }
            }
          }
        });
        
        window.dispatchEvent(event);
        
        // Small delay between creating diffs to avoid overwhelming the editor
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error creating diff for suggestion:', error);
      }
    }
    
    console.groupEnd();
  }
  
  async function reanalyzeSegment() {
    if (!selectedSegment || !summary || isReanalyzing) return;
    
    isReanalyzing = true;
    
    try {
      // First delete the existing analysis from database
      const deleteResponse = await fetch(`/api/transcript-analysis/segments/${fileId}/${selectedSegment.index}`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        console.warn('Failed to delete existing analysis, continuing with re-analysis');
      }
      
      // Clear the current results
      segmentAnalysisResult = null;
      applyingStates = {};
      
      // Perform fresh analysis
      await analyzeSelectedSegment();
    } finally {
      isReanalyzing = false;
    }
  }
  
  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  }
  
  async function applySuggestion(suggestion: any, index: number) {
    if (!suggestion?.originalText || !suggestion?.suggestedText || applyingStates[index]) {
      return;
    }
    
    // Check if a diff has already been created for this suggestion
    if (suggestion.diffCreated) {
      console.log('Diff already created for this suggestion:', suggestion.diffId);
      return;
    }
    
    applyingStates[index] = true;
    
    try {
      // If we have position info and reconciliation service, reconcile first
      let reconciledSuggestion = { ...suggestion };
      
      // Only attempt reconciliation if we have valid positions (not 0,0 or undefined)
      const hasValidPositions = suggestion.from !== undefined && 
                               suggestion.to !== undefined && 
                               suggestion.from >= 0 && 
                               suggestion.to > suggestion.from;
      
      if (hasValidPositions && reconciliationService) {
        // Add to reconciliation service for tracking
        const editId = reconciliationService.addPendingEdit({
          id: `suggestion_${index}_${Date.now()}`,
          type: 'suggestion',
          from: suggestion.from,
          to: suggestion.to,
          originalText: suggestion.originalText,
          suggestedText: suggestion.suggestedText,
          confidence: suggestion.confidence || 0.5,
          version: documentVersionAtAnalysis || { id: 'unknown', timestamp: Date.now(), transactionCount: 0 }
        });
        
        // Reconcile to current document state
        const reconcileResult = await reconciliationService.reconcileEdit(editId);
        
        if (reconcileResult.success && reconcileResult.newFrom !== undefined && reconcileResult.newTo !== undefined) {
          console.log(`📍 Reconciled positions: [${suggestion.from}, ${suggestion.to}] → [${reconcileResult.newFrom}, ${reconcileResult.newTo}]`);
          reconciledSuggestion.from = reconcileResult.newFrom;
          reconciledSuggestion.to = reconcileResult.newTo;
        } else if (!reconcileResult.success) {
          console.warn('Position reconciliation failed, falling back to text search');
          // Clear positions to trigger text search
          delete reconciledSuggestion.from;
          delete reconciledSuggestion.to;
        }
      } else if (!hasValidPositions) {
        // Make sure positions are not set when invalid
        delete reconciledSuggestion.from;
        delete reconciledSuggestion.to;
        console.log('No valid positions available, will use text search');
      }
      
      // Dispatch event to create diff node
      const event = new CustomEvent('applyTranscriptSuggestionAsDiff', {
        detail: {
          suggestion: reconciledSuggestion,
          segmentId: selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker',
          callback: (result: any) => {
            if (result.success) {
              // Mark as having diff created
              if (segmentAnalysisResult?.suggestions) {
                segmentAnalysisResult.suggestions[index] = {
                  ...suggestion,
                  diffCreated: true,
                  diffId: result.diffId,
                  appliedAt: result.appliedAt
                };
              }
              console.log(`✅ Manual diff created: ${result.diffId}`);
            } else {
              console.error('Failed to create diff:', result.error);
            }
            applyingStates[index] = false;
          }
        }
      });
      
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to create diff for suggestion:', error);
      applyingStates[index] = false;
    }
  }
  
  onMount(() => {
    // Subscribe to analysis state
    const unsubscribeAnalysis = analysisStateStore.subscribe(fileId, (state) => {
      analysisState = state;
    });
    
    return () => {
      unsubscribeAnalysis();
    };
  });
  
  onDestroy(() => {
    unsubscribe();
    
    // Clean up reconciliation service
    if (reconciliationService) {
      reconciliationService.stopPeriodicReconciliation();
    }
  });
</script>

<aside class="transcript-sidebar {collapsed ? 'collapsed' : ''}">
  <div class="sidebar-header">
    <button
      class="collapse-btn"
      onclick={toggleCollapsed}
      title={collapsed ? $_('transcript.sidebar.expand') : $_('transcript.sidebar.collapse')}
    >
      <Icon data={collapsed ? chevronRight : chevronLeft} />
    </button>
    
    {#if !collapsed}
      <h3>{$_('transcript.sidebar.title')}</h3>
    {/if}
  </div>
  
  {#if !collapsed}
    <div class="sidebar-content">
      {#if selectedSegment}
        <!-- Selected Segment Info -->
        <div class="segment-info">
          <div class="segment-header">
            <div class="segment-speaker">
              <Icon data={user} scale={0.8} />
              <span>{selectedSegment.speakerName || selectedSegment.speakerTag || 'Speaker'}</span>
            </div>
            {#if selectedSegment.start >= 0 && selectedSegment.end >= 0}
              <div class="segment-timing">
                <Icon data={clockO} scale={0.8} />
                <span>{formatTimestamp(selectedSegment.start)} - {formatTimestamp(selectedSegment.end)}</span>
                <span class="duration">({formatDuration(selectedSegment.start, selectedSegment.end)})</span>
              </div>
            {/if}
          </div>
          
          <!-- Segment Text Preview -->
          <div class="segment-preview">
            <h4>{$_('transcript.sidebar.segmentText')}</h4>
            <div class="segment-text">
              {segmentText.slice(0, 200)}{segmentText.length > 200 ? '...' : ''}
            </div>
          </div>
          
          <!-- Analyze Button -->
          <button
            class="analyze-segment-btn"
            onclick={analyzeSelectedSegment}
            disabled={isAnalyzing || !summary}
          >
            {#if isAnalyzing}
              <Icon data={spinner} spin />
              {$_('transcript.analysis.analyzing')}
            {:else if segmentAnalysisResult}
              <Icon data={check} />
              {$_('transcript.analysis.analyzed')}
            {:else}
              <Icon data={flask} />
              {$_('transcript.analysis.analyzeSegment')}
            {/if}
          </button>
          
          <!-- Analysis in Progress Notice -->
          {#if isAnalyzing}
            <div class="analysis-status">
              <div class="status-header">
                <Icon data={spinner} spin scale={0.9} />
                <span class="status-text">{$_('transcript.analysis.analyzingStatus')}</span>
              </div>
              <p class="status-message">{$_('transcript.analysis.analyzingMessage')}</p>
            </div>
            
            <!-- Tool Progress Display -->
            <ToolProgressDisplay {toolProgress} showCompleted={false} />
          {/if}
          
          <!-- Analysis Results -->
          {#if segmentAnalysisResult}
            <div class="analysis-results">
              <div class="results-header">
                <h4>{$_('transcript.analysis.results')}</h4>
                <button 
                  class="reanalyze-btn" 
                  onclick={reanalyzeSegment}
                  disabled={isReanalyzing}
                  title={$_('transcript.analysis.reanalyze')}
                >
                  {#if isReanalyzing}
                    <Icon data={spinner} spin scale={0.8} />
                  {:else}
                    <Icon data={refresh} scale={0.8} />
                  {/if}
                  <span>{isReanalyzing ? $_('transcript.analysis.reanalyzing') : $_('transcript.analysis.reanalyze')}</span>
                </button>
              </div>
              
              <!-- Suggestions Section -->
              {#if segmentAnalysisResult?.suggestions && Array.isArray(segmentAnalysisResult.suggestions) && segmentAnalysisResult.suggestions.length > 0}
                <div class="suggestions-section">
                  <h5>{$_('transcript.analysis.suggestions')} ({segmentAnalysisResult.suggestions.length})</h5>
                  {#each (segmentAnalysisResult.suggestions as any[]) as suggestion, index}
                    <div class="suggestion-item">
                      <div class="suggestion-header">
                        <span class="suggestion-type">{suggestion?.type ? $_(`transcript.suggestion.${suggestion.type}`) : $_('transcript.suggestion.unknown')}</span>
                        <div class="suggestion-header-right">
                          <span 
                            class="suggestion-severity" 
                            style="color: {getSeverityColor(suggestion?.severity || 'low')}"
                          >
                            {$_(`transcript.severity.${suggestion?.severity || 'low'}`)}
                          </span>
                          {#if suggestion?.diffCreated}
                            <span class="diff-badge">{$_('transcript.suggestion.diffCreated') || 'Diff Created'}</span>
                          {:else if suggestion?.applied}
                            <span class="applied-badge">{$_('transcript.suggestion.applied')}</span>
                          {:else if suggestion?.originalText && suggestion?.suggestedText}
                            <button 
                              class="apply-suggestion-btn"
                              onclick={() => applySuggestion(suggestion, index)}
                              disabled={applyingStates[index]}
                            >
                              {#if applyingStates[index]}
                                <Icon data={spinner} spin scale={0.7} />
                              {:else}
                                <Icon data={wrench} scale={0.7} />
                              {/if}
                              <span>{applyingStates[index] ? $_('transcript.suggestion.applying') : $_('transcript.suggestion.apply')}</span>
                            </button>
                          {/if}
                        </div>
                      </div>
                      <p class="suggestion-text">{suggestion?.text || suggestion?.explanation || $_('transcript.suggestion.noDescription')}</p>
                      {#if suggestion?.originalText && suggestion?.suggestedText}
                        <div class="suggestion-changes">
                          <div class="original">
                            <strong>{$_('transcript.suggestion.original')}:</strong> {suggestion.originalText}
                          </div>
                          <div class="suggested">
                            <strong>{$_('transcript.suggestion.suggested')}:</strong> {suggestion.suggestedText}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="no-suggestions">
                  <p>{$_('transcript.analysis.noSuggestions')}</p>
                </div>
              {/if}
              
              <!-- Original SegmentControlPosition component (if needed) -->
              <SegmentControlPosition
                {fileId}
                {editorContent}
                {audioFilePath}
                {summary}
                onSegmentAnalyzed={onSegmentAnalyzed}
              />
            </div>
          {/if}
        </div>
      {:else}
        <!-- No Segment Selected -->
        <div class="no-segment">
          <p>{$_('transcript.sidebar.noSegmentSelected')}</p>
          <p class="hint">{$_('transcript.sidebar.clickToSelect')}</p>
        </div>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .transcript-sidebar {
    background: white;
    border-left: 1px solid #e5e7eb;
    height: 100%;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    width: 400px;
    position: relative;
  }
  
  .transcript-sidebar.collapsed {
    width: 48px;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #f9fafb;
  }
  
  .collapse-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: #6b7280;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .collapse-btn:hover {
    color: #374151;
  }
  
  .sidebar-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .segment-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .segment-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .segment-speaker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #374151;
  }
  
  .segment-timing {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .duration {
    font-size: 0.75rem;
    color: #9ca3af;
  }
  
  .segment-preview {
    background: #f9fafb;
    border-radius: 0.5rem;
    padding: 1rem;
  }
  
  .segment-preview h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .segment-text {
    font-size: 0.875rem;
    line-height: 1.6;
    color: #374151;
    word-wrap: break-word;
  }
  
  .analyze-segment-btn {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .analyze-segment-btn:hover:not(:disabled) {
    background: var(--primary-hover, #2563eb);
  }
  
  .analyze-segment-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .analysis-results {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .results-header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .reanalyze-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #e5e7eb;
    background: white;
    color: #6b7280;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .reanalyze-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #374151;
  }
  
  .reanalyze-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .suggestions-section {
    margin-bottom: 1rem;
  }
  
  .suggestions-section h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
  }
  
  .suggestion-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .suggestion-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .suggestion-type {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .suggestion-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .suggestion-severity {
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .applied-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: #d1fae5;
    color: #065f46;
    border-radius: 0.25rem;
    font-weight: 500;
  }
  
  .diff-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: #fef3c7;
    color: #92400e;
    border-radius: 0.25rem;
    font-weight: 500;
  }
  
  .apply-suggestion-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #3b82f6;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .apply-suggestion-btn:hover:not(:disabled) {
    background: #3b82f6;
    color: white;
  }
  
  .apply-suggestion-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .suggestion-text {
    font-size: 0.8125rem;
    color: #4b5563;
    line-height: 1.5;
    margin: 0 0 0.5rem 0;
  }
  
  .suggestion-changes {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .original,
  .suggested {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .original strong,
  .suggested strong {
    font-weight: 600;
    color: #374151;
    min-width: 70px;
  }
  
  .original {
    color: #dc2626;
  }
  
  .suggested {
    color: #059669;
  }
  
  .no-suggestions {
    text-align: center;
    padding: 1.5rem 1rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .no-suggestions p {
    margin: 0;
  }
  
  .no-segment {
    text-align: center;
    padding: 2rem 1rem;
    color: #6b7280;
  }
  
  .no-segment p {
    margin: 0 0 0.5rem 0;
  }
  
  .hint {
    font-size: 0.875rem;
    font-style: italic;
    color: #9ca3af;
  }
  
  .analysis-status {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #f0f9ff;
    border-left: 3px solid #3b82f6;
    border-radius: 0.25rem;
  }
  
  .status-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .status-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e40af;
  }
  
  .status-message {
    margin: 0;
    font-size: 0.75rem;
    color: #64748b;
    line-height: 1.4;
  }
  
  /* Mobile responsiveness */
  @media (max-width: 1024px) {
    .transcript-sidebar {
      position: fixed;
      right: 0;
      top: 0;
      height: 100vh;
      z-index: 1000;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .transcript-sidebar:not(.collapsed) {
      width: 100%;
      max-width: 400px;
    }
  }
</style>