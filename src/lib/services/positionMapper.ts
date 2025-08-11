import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { Mapping, StepMap } from 'prosemirror-transform';
import type { Transaction } from 'prosemirror-state';

/**
 * Position mapping result after transformations
 */
export interface MappedPosition {
  // Original position
  original: number;
  
  // Mapped position after transformations
  mapped: number;
  
  // Whether the position was deleted
  deleted: boolean;
  
  // Confidence in the mapping (0-1)
  confidence: number;
}

/**
 * Document version tracking
 */
export interface DocumentVersion {
  id: string;
  timestamp: number;
  transactionCount: number;
  contentHash?: string;
}

/**
 * Position mapper for handling concurrent edits
 */
export class PositionMapper {
  private mapping: Mapping;
  private version: DocumentVersion;
  private transactionHistory: Transaction[] = [];
  private maxHistorySize = 100;
  
  constructor() {
    this.mapping = new Mapping();
    this.version = {
      id: this.generateVersionId(),
      timestamp: Date.now(),
      transactionCount: 0
    };
  }
  
  /**
   * Record a transaction for position mapping
   */
  recordTransaction(tr: Transaction): void {
    // Add transaction to history
    this.transactionHistory.push(tr);
    
    // Add steps to mapping
    tr.steps.forEach((step, index) => {
      const stepMap = tr.docs[index] ? step.getMap() : null;
      if (stepMap) {
        this.mapping.appendMap(stepMap);
      }
    });
    
    // Update version
    this.version.transactionCount++;
    this.version.timestamp = Date.now();
    
    // Trim history if too large
    if (this.transactionHistory.length > this.maxHistorySize) {
      this.transactionHistory = this.transactionHistory.slice(-this.maxHistorySize);
    }
  }
  
  /**
   * Map a position through all recorded transformations
   */
  mapPosition(pos: number, bias: -1 | 0 | 1 = 1): MappedPosition {
    try {
      const mapped = this.mapping.map(pos, bias);
      
      // Check if position was deleted
      const deleted = mapped === null || mapped === undefined;
      
      return {
        original: pos,
        mapped: deleted ? pos : mapped,
        deleted,
        confidence: deleted ? 0 : 1
      };
    } catch (error) {
      console.error('Error mapping position:', error);
      return {
        original: pos,
        mapped: pos,
        deleted: false,
        confidence: 0
      };
    }
  }
  
  /**
   * Map a range through transformations
   */
  mapRange(from: number, to: number): {
    from: MappedPosition;
    to: MappedPosition;
    valid: boolean;
  } {
    const mappedFrom = this.mapPosition(from, 1);
    const mappedTo = this.mapPosition(to, -1);
    
    // Check if range is still valid
    const valid = !mappedFrom.deleted && 
                  !mappedTo.deleted && 
                  mappedFrom.mapped <= mappedTo.mapped;
    
    return {
      from: mappedFrom,
      to: mappedTo,
      valid
    };
  }
  
  /**
   * Reset mapping (use when document is reloaded)
   */
  reset(): void {
    this.mapping = new Mapping();
    this.transactionHistory = [];
    this.version = {
      id: this.generateVersionId(),
      timestamp: Date.now(),
      transactionCount: 0
    };
  }
  
  /**
   * Get current version info
   */
  getVersion(): DocumentVersion {
    return { ...this.version };
  }
  
  /**
   * Generate unique version ID
   */
  private generateVersionId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Position recovery strategies when mapping fails
 */
export class PositionRecovery {
  /**
   * Try to recover position using text context
   */
  static recoverByTextContext(
    doc: ProseMirrorNode,
    originalText: string,
    approximatePos: number,
    searchRadius: number = 100
  ): { from: number; to: number } | null {
    // Search in a radius around the approximate position
    const start = Math.max(0, approximatePos - searchRadius);
    const end = Math.min(doc.content.size, approximatePos + searchRadius);
    
    // Get text in search area
    const searchText = doc.textBetween(start, end, ' ');
    
    // Try to find the original text
    const normalizedOriginal = originalText.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedSearch = searchText.replace(/\s+/g, ' ').toLowerCase();
    
    const index = normalizedSearch.indexOf(normalizedOriginal);
    if (index !== -1) {
      // Found the text, calculate actual positions
      // This is approximate due to whitespace normalization
      const foundStart = start + index;
      const foundEnd = foundStart + originalText.length;
      
      // Verify the found text matches
      const foundText = doc.textBetween(foundStart, foundEnd, ' ');
      if (foundText.toLowerCase() === originalText.toLowerCase()) {
        return { from: foundStart, to: foundEnd };
      }
    }
    
    return null;
  }
  
  /**
   * Find nearest valid position
   */
  static findNearestValidPosition(
    doc: ProseMirrorNode,
    pos: number,
    direction: 'before' | 'after' = 'after'
  ): number {
    // Ensure position is within document bounds
    const clampedPos = Math.max(0, Math.min(pos, doc.content.size));
    
    try {
      const $pos = doc.resolve(clampedPos);
      
      if (direction === 'before') {
        // Find previous valid position
        return $pos.before($pos.depth);
      } else {
        // Find next valid position
        return $pos.after($pos.depth);
      }
    } catch (error) {
      // If resolve fails, return clamped position
      return clampedPos;
    }
  }
  
  /**
   * Validate and adjust position range
   */
  static validateRange(
    doc: ProseMirrorNode,
    from: number,
    to: number
  ): { from: number; to: number; valid: boolean } {
    // Ensure positions are within bounds
    const validFrom = Math.max(0, Math.min(from, doc.content.size));
    const validTo = Math.max(validFrom, Math.min(to, doc.content.size));
    
    // Check if range contains expected content structure
    let valid = true;
    try {
      doc.nodesBetween(validFrom, validTo, () => {
        // Just checking if traversal works
        return true;
      });
    } catch (error) {
      valid = false;
    }
    
    return {
      from: validFrom,
      to: validTo,
      valid
    };
  }
}

/**
 * Transaction reconciliation for concurrent edits
 */
export class TransactionReconciler {
  private pendingSuggestions: Map<string, {
    from: number;
    to: number;
    originalText: string;
    suggestedText: string;
    version: DocumentVersion;
  }> = new Map();
  
  /**
   * Store a pending suggestion with version info
   */
  storePendingSuggestion(
    id: string,
    suggestion: {
      from: number;
      to: number;
      originalText: string;
      suggestedText: string;
    },
    version: DocumentVersion
  ): void {
    this.pendingSuggestions.set(id, {
      ...suggestion,
      version
    });
  }
  
  /**
   * Reconcile a pending suggestion with current document state
   */
  reconcileSuggestion(
    id: string,
    mapper: PositionMapper,
    doc: ProseMirrorNode
  ): {
    reconciled: boolean;
    from?: number;
    to?: number;
    confidence: number;
  } {
    const suggestion = this.pendingSuggestions.get(id);
    if (!suggestion) {
      return { reconciled: false, confidence: 0 };
    }
    
    // Map positions through transformations
    const mappedRange = mapper.mapRange(suggestion.from, suggestion.to);
    
    if (mappedRange.valid) {
      // Validate content at mapped positions
      const currentText = doc.textBetween(
        mappedRange.from.mapped,
        mappedRange.to.mapped,
        ' '
      );
      
      const matches = currentText.toLowerCase() === suggestion.originalText.toLowerCase();
      
      if (matches) {
        return {
          reconciled: true,
          from: mappedRange.from.mapped,
          to: mappedRange.to.mapped,
          confidence: 1
        };
      }
    }
    
    // Try recovery by text context
    const recovered = PositionRecovery.recoverByTextContext(
      doc,
      suggestion.originalText,
      mappedRange.from.mapped,
      200
    );
    
    if (recovered) {
      return {
        reconciled: true,
        from: recovered.from,
        to: recovered.to,
        confidence: 0.8
      };
    }
    
    return { reconciled: false, confidence: 0 };
  }
  
  /**
   * Clear old pending suggestions
   */
  clearOldSuggestions(maxAge: number = 60000): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.pendingSuggestions.forEach((suggestion, id) => {
      if (now - suggestion.version.timestamp > maxAge) {
        toDelete.push(id);
      }
    });
    
    toDelete.forEach(id => this.pendingSuggestions.delete(id));
  }
}

/**
 * Global position mapper instance per editor
 */
const mapperInstances = new WeakMap<Editor, PositionMapper>();

/**
 * Get or create position mapper for editor
 */
export function getPositionMapper(editor: Editor): PositionMapper {
  if (!mapperInstances.has(editor)) {
    const mapper = new PositionMapper();
    
    // Listen to transactions
    const updateHandler = (props: { editor: Editor; transaction: Transaction }) => {
      mapper.recordTransaction(props.transaction);
    };
    
    editor.on('transaction', updateHandler);
    mapperInstances.set(editor, mapper);
  }
  
  return mapperInstances.get(editor)!;
}

/**
 * Create a scoped position mapper for a specific operation
 */
export function createScopedMapper(): PositionMapper {
  return new PositionMapper();
}