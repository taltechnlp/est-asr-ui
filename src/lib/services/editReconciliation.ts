import type { Editor } from '@tiptap/core';
import type { Transaction } from 'prosemirror-state';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { getPositionMapper, type DocumentVersion } from './positionMapper';
import type { PositionAwareSegment } from './positionAwareExtractor';

/**
 * Edit reconciliation service for handling concurrent edits
 * and maintaining consistency between LLM suggestions and document state
 */

export interface PendingEdit {
  id: string;
  type: 'suggestion' | 'diff' | 'replacement';
  from: number;
  to: number;
  originalText: string;
  suggestedText: string;
  segmentId?: string;
  confidence: number;
  timestamp: number;
  version: DocumentVersion;
  status: 'pending' | 'applied' | 'rejected' | 'stale';
}

export interface ReconciliationResult {
  id: string;
  success: boolean;
  newFrom?: number;
  newTo?: number;
  confidence: number;
  requiresFallback: boolean;
  error?: string;
}

/**
 * Service for reconciling edits across document versions
 */
export class EditReconciliationService {
  private pendingEdits = new Map<string, PendingEdit>();
  private appliedEdits = new Set<string>();
  private editor: Editor | null = null;
  private reconciliationInProgress = false;
  
  // Configuration
  private readonly maxPendingAge = 60000; // 1 minute
  private readonly maxPendingEdits = 100;
  private readonly reconciliationInterval = 5000; // 5 seconds
  
  private reconciliationTimer: NodeJS.Timeout | null = null;
  
  constructor(editor?: Editor) {
    if (editor) {
      this.setEditor(editor);
    }
  }
  
  /**
   * Set the editor and start monitoring
   */
  setEditor(editor: Editor): void {
    this.editor = editor;
    
    // Listen to transactions for automatic reconciliation
    editor.on('transaction', ({ transaction }) => {
      this.onTransaction(transaction);
    });
    
    // Start periodic reconciliation
    this.startPeriodicReconciliation();
  }
  
  /**
   * Handle document transaction
   */
  private onTransaction(tr: Transaction): void {
    // Don't reconcile for our own changes
    if (tr.getMeta('reconciliation')) {
      return;
    }
    
    // Mark pending edits that might be affected
    if (tr.docChanged) {
      this.markAffectedEdits(tr);
    }
  }
  
  /**
   * Mark edits that might be affected by a transaction
   */
  private markAffectedEdits(tr: Transaction): void {
    const mapper = this.editor ? getPositionMapper(this.editor) : null;
    if (!mapper) return;
    
    this.pendingEdits.forEach((edit) => {
      if (edit.status === 'pending') {
        // Check if edit range was affected
        const mappedRange = mapper.mapRange(edit.from, edit.to);
        if (!mappedRange.valid || mappedRange.from.deleted || mappedRange.to.deleted) {
          // Mark as potentially stale
          edit.status = 'stale';
        }
      }
    });
  }
  
  /**
   * Add a pending edit for tracking
   */
  addPendingEdit(edit: Omit<PendingEdit, 'timestamp' | 'status'>): string {
    const id = edit.id || this.generateEditId();
    
    this.pendingEdits.set(id, {
      ...edit,
      id,
      timestamp: Date.now(),
      status: 'pending'
    });
    
    // Clean up old edits if too many
    if (this.pendingEdits.size > this.maxPendingEdits) {
      this.cleanupOldEdits();
    }
    
    return id;
  }
  
  /**
   * Reconcile a specific edit
   */
  async reconcileEdit(editId: string): Promise<ReconciliationResult> {
    const edit = this.pendingEdits.get(editId);
    
    if (!edit) {
      return {
        id: editId,
        success: false,
        confidence: 0,
        requiresFallback: false,
        error: 'Edit not found'
      };
    }
    
    if (!this.editor) {
      return {
        id: editId,
        success: false,
        confidence: 0,
        requiresFallback: false,
        error: 'Editor not available'
      };
    }
    
    const mapper = getPositionMapper(this.editor);
    const doc = this.editor.state.doc;
    
    // Map positions to current document state
    const mappedRange = mapper.mapRange(edit.from, edit.to);
    
    if (mappedRange.valid && !mappedRange.from.deleted && !mappedRange.to.deleted) {
      // Validate content at mapped positions
      const currentText = doc.textBetween(mappedRange.from.mapped, mappedRange.to.mapped, ' ');
      const textMatches = this.normalizeText(currentText) === this.normalizeText(edit.originalText);
      
      if (textMatches) {
        // Positions and text both valid
        return {
          id: editId,
          success: true,
          newFrom: mappedRange.from.mapped,
          newTo: mappedRange.to.mapped,
          confidence: Math.min(mappedRange.from.confidence, mappedRange.to.confidence),
          requiresFallback: false
        };
      }
    }
    
    // Try to recover using text search
    const recovered = this.recoverEditPosition(doc, edit);
    
    if (recovered) {
      return {
        id: editId,
        success: true,
        newFrom: recovered.from,
        newTo: recovered.to,
        confidence: 0.7,
        requiresFallback: true
      };
    }
    
    // Mark as stale if reconciliation failed
    edit.status = 'stale';
    
    return {
      id: editId,
      success: false,
      confidence: 0,
      requiresFallback: true,
      error: 'Could not reconcile edit position'
    };
  }
  
  /**
   * Reconcile all pending edits
   */
  async reconcileAllPending(): Promise<Map<string, ReconciliationResult>> {
    if (this.reconciliationInProgress) {
      return new Map();
    }
    
    this.reconciliationInProgress = true;
    const results = new Map<string, ReconciliationResult>();
    
    try {
      for (const [id, edit] of this.pendingEdits) {
        if (edit.status === 'pending' || edit.status === 'stale') {
          const result = await this.reconcileEdit(id);
          results.set(id, result);
          
          if (!result.success) {
            // Mark as stale after failed reconciliation
            edit.status = 'stale';
          }
        }
      }
    } finally {
      this.reconciliationInProgress = false;
    }
    
    return results;
  }
  
  /**
   * Try to recover edit position using text search
   */
  private recoverEditPosition(
    doc: ProseMirrorNode,
    edit: PendingEdit
  ): { from: number; to: number } | null {
    const searchRadius = 500; // Search within 500 positions
    const startSearch = Math.max(0, edit.from - searchRadius);
    const endSearch = Math.min(doc.content.size, edit.to + searchRadius);
    
    // Get text in search area
    try {
      const searchText = doc.textBetween(startSearch, endSearch, ' ');
      const normalizedOriginal = this.normalizeText(edit.originalText);
      const normalizedSearch = this.normalizeText(searchText);
      
      const index = normalizedSearch.indexOf(normalizedOriginal);
      
      if (index !== -1) {
        // Calculate approximate positions
        // This is not exact due to whitespace normalization
        const foundFrom = startSearch + this.estimatePosition(searchText, index);
        const foundTo = foundFrom + edit.originalText.length;
        
        // Verify the found text
        const verifyText = doc.textBetween(foundFrom, foundTo, ' ');
        if (this.normalizeText(verifyText) === normalizedOriginal) {
          return { from: foundFrom, to: foundTo };
        }
      }
    } catch (error) {
      console.error('Error recovering edit position:', error);
    }
    
    return null;
  }
  
  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  
  /**
   * Estimate actual position from normalized position
   */
  private estimatePosition(text: string, normalizedIndex: number): number {
    // This is a rough estimate
    // In practice, you'd need more sophisticated position tracking
    return normalizedIndex;
  }
  
  /**
   * Clean up old pending edits
   */
  private cleanupOldEdits(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.pendingEdits.forEach((edit, id) => {
      if (now - edit.timestamp > this.maxPendingAge || edit.status === 'applied' || edit.status === 'rejected') {
        toDelete.push(id);
      }
    });
    
    toDelete.forEach(id => this.pendingEdits.delete(id));
  }
  
  /**
   * Start periodic reconciliation
   */
  private startPeriodicReconciliation(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
    }
    
    this.reconciliationTimer = setInterval(() => {
      this.reconcileAllPending().catch(error => {
        console.error('Periodic reconciliation error:', error);
      });
    }, this.reconciliationInterval);
  }
  
  /**
   * Stop periodic reconciliation
   */
  stopPeriodicReconciliation(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
  }
  
  /**
   * Generate unique edit ID
   */
  private generateEditId(): string {
    return `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get pending edits summary
   */
  getPendingEditsSummary(): {
    total: number;
    pending: number;
    stale: number;
    applied: number;
    rejected: number;
  } {
    let pending = 0;
    let stale = 0;
    let applied = 0;
    let rejected = 0;
    
    this.pendingEdits.forEach(edit => {
      switch (edit.status) {
        case 'pending': pending++; break;
        case 'stale': stale++; break;
        case 'applied': applied++; break;
        case 'rejected': rejected++; break;
      }
    });
    
    return {
      total: this.pendingEdits.size,
      pending,
      stale,
      applied,
      rejected
    };
  }
  
  /**
   * Clear all pending edits
   */
  clearPendingEdits(): void {
    this.pendingEdits.clear();
    this.appliedEdits.clear();
  }
  
  /**
   * Mark an edit as applied
   */
  markEditApplied(editId: string): void {
    const edit = this.pendingEdits.get(editId);
    if (edit) {
      edit.status = 'applied';
      this.appliedEdits.add(editId);
    }
  }
  
  /**
   * Mark an edit as rejected
   */
  markEditRejected(editId: string): void {
    const edit = this.pendingEdits.get(editId);
    if (edit) {
      edit.status = 'rejected';
    }
  }
}

/**
 * Global reconciliation service instances
 */
const reconciliationServices = new WeakMap<Editor, EditReconciliationService>();

/**
 * Get or create reconciliation service for editor
 */
export function getReconciliationService(editor: Editor): EditReconciliationService {
  if (!reconciliationServices.has(editor)) {
    const service = new EditReconciliationService(editor);
    reconciliationServices.set(editor, service);
  }
  
  return reconciliationServices.get(editor)!;
}