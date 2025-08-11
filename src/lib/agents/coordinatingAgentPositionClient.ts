import { PositionAwareTipTapToolDirect } from './tools/positionAwareTiptapTool';
import type { Editor } from '@tiptap/core';
import {
  extractSpeakerSegmentsWithPositions,
  type PositionAwareSegment
} from '$lib/services/positionAwareExtractor';
import { getReconciliationService } from '$lib/services/editReconciliation';
import { getPositionMapper } from '$lib/services/positionMapper';

/**
 * Client-side version of the position-aware coordinating agent
 * This version only handles TipTap transactions and position mapping
 * Server-side analysis is done via API calls
 */
export class CoordinatingAgentPositionClient {
  private positionTool: PositionAwareTipTapToolDirect;
  private editor: Editor | null = null;
  private reconciliationService: any = null;
  private currentSegments: PositionAwareSegment[] = [];
  
  constructor() {
    this.positionTool = new PositionAwareTipTapToolDirect();
  }
  
  setEditor(editor: Editor) {
    this.editor = editor;
    this.positionTool.setEditor(editor);
    this.reconciliationService = getReconciliationService(editor);
  }
  
  /**
   * Extract position-aware segments from the current editor
   */
  extractSegments(): PositionAwareSegment[] {
    if (!this.editor) {
      console.error('Editor not set');
      return [];
    }
    
    this.currentSegments = extractSpeakerSegmentsWithPositions(this.editor);
    this.positionTool.setSegments(this.currentSegments);
    return this.currentSegments;
  }
  
  /**
   * Apply a position-based suggestion from the server
   */
  async applyPositionBasedSuggestion(
    suggestion: any,
    segmentId?: string
  ): Promise<{ success: boolean; error?: string; diffId?: string }> {
    try {
      // Check if this is a position-based suggestion
      if (suggestion.segmentId && 
          suggestion.startChar !== undefined && 
          suggestion.endChar !== undefined) {
        
        // Ensure segments are current
        if (this.currentSegments.length === 0) {
          this.extractSegments();
        }
        
        // Apply using position-based approach
        const result = await this.positionTool.applyPositionBasedChange({
          segmentId: suggestion.segmentId,
          startChar: suggestion.startChar,
          endChar: suggestion.endChar,
          originalText: suggestion.originalText || '',
          suggestedText: suggestion.suggestedText || '',
          changeType: suggestion.type || 'text_replacement',
          confidence: suggestion.confidence || 0.5,
          context: suggestion.explanation || suggestion.text || ''
        });
        
        const positionResult = JSON.parse(result);
        
        if (positionResult.success && this.reconciliationService) {
          // Track in reconciliation service
          const mapper = this.editor ? getPositionMapper(this.editor) : null;
          if (mapper) {
            this.reconciliationService.addPendingEdit({
              id: positionResult.diffId,
              type: 'suggestion',
              from: positionResult.appliedAt,
              to: positionResult.appliedAt + (suggestion.suggestedText?.length || 0),
              originalText: suggestion.originalText,
              suggestedText: suggestion.suggestedText,
              segmentId: suggestion.segmentId,
              confidence: suggestion.confidence,
              version: mapper.getVersion()
            });
          }
        }
        
        return positionResult;
      } else {
        // Fall back to text-based approach for non-position suggestions
        return this.applyTextBasedSuggestion(suggestion, segmentId);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Apply a text-based suggestion (fallback)
   */
  private async applyTextBasedSuggestion(
    suggestion: any,
    segmentId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!suggestion.originalText || !suggestion.suggestedText) {
        return { success: false, error: 'Missing original or suggested text' };
      }
      
      // Import the text-based tool dynamically
      const { TipTapTransactionToolDirect } = await import('./tools/tiptapTransaction');
      const textTool = new TipTapTransactionToolDirect();
      
      if (this.editor) {
        textTool.setEditor(this.editor);
      }
      
      const result = await textTool.applyTransaction({
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        segmentId: segmentId,
        changeType: suggestion.type || 'text_replacement',
        confidence: suggestion.confidence || 0.5,
        context: suggestion.text || suggestion.explanation || ''
      });
      
      return JSON.parse(result);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Reconcile pending suggestions after document changes
   */
  async reconcilePendingSuggestions(): Promise<{
    reconciled: number;
    failed: number;
  }> {
    if (!this.reconciliationService) {
      return { reconciled: 0, failed: 0 };
    }
    
    const results = await this.reconciliationService.reconcileAllPending();
    
    let reconciled = 0;
    let failed = 0;
    
    results.forEach((result: any) => {
      if (result.success) {
        reconciled++;
      } else {
        failed++;
      }
    });
    
    return { reconciled, failed };
  }
  
  /**
   * Get pending edits summary
   */
  getPendingEditsSummary() {
    if (!this.reconciliationService) {
      return {
        total: 0,
        pending: 0,
        stale: 0,
        applied: 0,
        rejected: 0
      };
    }
    
    return this.reconciliationService.getPendingEditsSummary();
  }
  
  /**
   * Mark an edit as applied
   */
  markEditApplied(editId: string) {
    if (this.reconciliationService) {
      this.reconciliationService.markEditApplied(editId);
    }
  }
  
  /**
   * Mark an edit as rejected
   */
  markEditRejected(editId: string) {
    if (this.reconciliationService) {
      this.reconciliationService.markEditRejected(editId);
    }
  }
}

// Singleton instance for client-side usage
let positionAgentClientInstance: CoordinatingAgentPositionClient | null = null;

export function getCoordinatingAgentPositionClient(): CoordinatingAgentPositionClient {
  if (!positionAgentClientInstance) {
    positionAgentClientInstance = new CoordinatingAgentPositionClient();
  }
  return positionAgentClientInstance;
}