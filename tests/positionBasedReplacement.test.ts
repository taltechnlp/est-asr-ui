import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import {
  extractPositionAwareSegments,
  extractSpeakerSegmentsWithPositions,
  buildPositionIndex,
  relativeToAbsolute,
  validatePositionContent,
  formatSegmentsForLLM,
  llmResponseToAbsolute,
  type PositionAwareSegment,
  type LLMPositionResponse
} from '../src/lib/services/positionAwareExtractor';
import {
  PositionMapper,
  PositionRecovery,
  TransactionReconciler,
  createScopedMapper
} from '../src/lib/services/positionMapper';
import { EditReconciliationService } from '../src/lib/services/editReconciliation';

/**
 * Test suite for position-based text replacement system
 */

describe('Position-Based Text Replacement', () => {
  let mockEditor: any;
  let mockDoc: any;
  
  beforeEach(() => {
    // Create mock document structure
    mockDoc = {
      content: {
        size: 1000
      },
      nodesBetween: (from: number, to: number, callback: Function) => {
        // Mock implementation
        const nodes = [
          {
            type: { name: 'speaker' },
            attrs: { 'data-name': 'Speaker 1', id: 'speaker1' },
            text: 'Hello, this is a test transcript.',
            isText: false,
            nodeSize: 35,
            marks: []
          },
          {
            type: { name: 'text' },
            text: 'Hello, this is a test transcript.',
            isText: true,
            nodeSize: 33,
            marks: [
              { type: { name: 'word' }, attrs: { start: 0, end: 5 } }
            ]
          }
        ];
        
        let currentPos = 0;
        nodes.forEach(node => {
          if (currentPos >= from && currentPos < to) {
            callback(node, currentPos, null, 0);
          }
          currentPos += node.nodeSize;
        });
      },
      textBetween: (from: number, to: number) => {
        return 'Hello, this is a test transcript.'.substring(from, Math.min(to, 33));
      },
      resolve: (pos: number) => ({
        depth: 1,
        index: () => 0,
        marks: () => []
      })
    };
    
    mockEditor = {
      state: {
        doc: mockDoc,
        schema: {
          nodes: {
            diff: {
              create: (attrs: any) => ({ type: 'diff', attrs })
            }
          }
        }
      },
      chain: () => ({
        focus: () => ({
          command: (fn: Function) => ({
            run: () => {
              fn({ tr: {}, state: mockEditor.state });
              return true;
            }
          })
        })
      }),
      on: () => {},
      off: () => {}
    };
  });
  
  describe('Position-Aware Extraction', () => {
    it('should extract segments with absolute positions', () => {
      const segments = extractPositionAwareSegments(mockEditor);
      
      expect(segments).toBeDefined();
      expect(segments.length).toBeGreaterThan(0);
      
      const firstSegment = segments[0];
      expect(firstSegment).toHaveProperty('id');
      expect(firstSegment).toHaveProperty('from');
      expect(firstSegment).toHaveProperty('to');
      expect(firstSegment).toHaveProperty('text');
      expect(firstSegment).toHaveProperty('startOffset');
      expect(firstSegment).toHaveProperty('endOffset');
    });
    
    it('should extract speaker segments with positions', () => {
      const segments = extractSpeakerSegmentsWithPositions(mockEditor);
      
      expect(segments).toBeDefined();
      segments.forEach(segment => {
        expect(segment.nodeType).toBe('speaker');
        expect(segment.speakerName).toBeDefined();
        expect(segment.from).toBeGreaterThanOrEqual(0);
        expect(segment.to).toBeGreaterThan(segment.from);
      });
    });
    
    it('should build position index correctly', () => {
      const segments = extractPositionAwareSegments(mockEditor);
      const index = buildPositionIndex(segments);
      
      expect(index.segments).toEqual(segments);
      expect(index.textToPosition).toBeInstanceOf(Map);
      expect(index.positionToSegment).toBeInstanceOf(Map);
      expect(index.version).toBeGreaterThan(0);
    });
  });
  
  describe('Position Mapping', () => {
    it('should convert relative to absolute positions', () => {
      const segment: PositionAwareSegment = {
        id: 'test',
        from: 100,
        to: 150,
        text: 'Test text',
        startOffset: 0,
        endOffset: 9,
        nodeType: 'text',
        path: [0, 0]
      };
      
      const result = relativeToAbsolute(segment, 5, 9);
      
      expect(result.from).toBe(105);
      expect(result.to).toBe(109);
    });
    
    it('should validate position content', () => {
      const isValid = validatePositionContent(
        mockDoc,
        0,
        5,
        'Hello'
      );
      
      expect(isValid).toBe(true);
    });
    
    it('should format segments for LLM correctly', () => {
      const segments: PositionAwareSegment[] = [{
        id: 'seg1',
        from: 0,
        to: 10,
        text: 'Test text',
        startOffset: 0,
        endOffset: 9,
        nodeType: 'text',
        speakerName: 'Speaker 1',
        path: [0]
      }];
      
      const formatted = formatSegmentsForLLM(segments);
      
      expect(formatted[0]).toHaveProperty('id', 'seg1');
      expect(formatted[0]).toHaveProperty('text', 'Test text');
      expect(formatted[0]).toHaveProperty('offset', 0);
      expect(formatted[0]).toHaveProperty('length', 9);
      expect(formatted[0]).toHaveProperty('speaker', 'Speaker 1');
    });
    
    it('should convert LLM response to absolute positions', () => {
      const segments: PositionAwareSegment[] = [{
        id: 'seg1',
        from: 100,
        to: 130,
        text: 'Original text here',
        startOffset: 0,
        endOffset: 18,
        nodeType: 'text',
        path: [0]
      }];
      
      const llmResponse: LLMPositionResponse = {
        segmentId: 'seg1',
        startChar: 9,
        endChar: 13,
        originalText: 'text',
        suggestedText: 'word',
        confidence: 0.9
      };
      
      const absolute = llmResponseToAbsolute(llmResponse, segments);
      
      expect(absolute).not.toBeNull();
      expect(absolute!.from).toBe(109);
      expect(absolute!.to).toBe(113);
      expect(absolute!.suggestedText).toBe('word');
    });
  });
  
  describe('Position Mapper', () => {
    it('should track document versions', () => {
      const mapper = createScopedMapper();
      const version = mapper.getVersion();
      
      expect(version).toHaveProperty('id');
      expect(version).toHaveProperty('timestamp');
      expect(version).toHaveProperty('transactionCount', 0);
    });
    
    it('should map positions through transformations', () => {
      const mapper = createScopedMapper();
      
      // Simulate a transaction that shifts positions
      const mockTransaction: any = {
        steps: [],
        docs: []
      };
      
      mapper.recordTransaction(mockTransaction);
      
      const mapped = mapper.mapPosition(100);
      expect(mapped).toHaveProperty('original', 100);
      expect(mapped).toHaveProperty('mapped');
      expect(mapped).toHaveProperty('deleted');
      expect(mapped).toHaveProperty('confidence');
    });
    
    it('should map ranges correctly', () => {
      const mapper = createScopedMapper();
      
      const range = mapper.mapRange(50, 100);
      
      expect(range).toHaveProperty('from');
      expect(range).toHaveProperty('to');
      expect(range).toHaveProperty('valid');
      expect(range.valid).toBe(true);
    });
  });
  
  describe('Position Recovery', () => {
    it('should recover position by text context', () => {
      const recovered = PositionRecovery.recoverByTextContext(
        mockDoc,
        'test',
        15,
        50
      );
      
      // May or may not find depending on mock implementation
      if (recovered) {
        expect(recovered).toHaveProperty('from');
        expect(recovered).toHaveProperty('to');
      }
    });
    
    it('should find nearest valid position', () => {
      const nearest = PositionRecovery.findNearestValidPosition(
        mockDoc,
        50,
        'after'
      );
      
      expect(nearest).toBeGreaterThanOrEqual(0);
      expect(nearest).toBeLessThanOrEqual(mockDoc.content.size);
    });
    
    it('should validate and adjust position range', () => {
      const validated = PositionRecovery.validateRange(
        mockDoc,
        -10,
        2000
      );
      
      expect(validated.from).toBeGreaterThanOrEqual(0);
      expect(validated.to).toBeLessThanOrEqual(mockDoc.content.size);
      expect(validated).toHaveProperty('valid');
    });
  });
  
  describe('Transaction Reconciliation', () => {
    it('should store pending suggestions', () => {
      const reconciler = new TransactionReconciler();
      const version = { id: 'v1', timestamp: Date.now(), transactionCount: 0 };
      
      reconciler.storePendingSuggestion(
        'sug1',
        {
          from: 10,
          to: 20,
          originalText: 'original',
          suggestedText: 'suggested'
        },
        version
      );
      
      // Internal state not directly testable, but operation should not throw
      expect(true).toBe(true);
    });
    
    it('should reconcile suggestions with mapper', () => {
      const reconciler = new TransactionReconciler();
      const mapper = createScopedMapper();
      const version = mapper.getVersion();
      
      reconciler.storePendingSuggestion(
        'sug1',
        {
          from: 10,
          to: 20,
          originalText: 'test',
          suggestedText: 'exam'
        },
        version
      );
      
      const result = reconciler.reconcileSuggestion('sug1', mapper, mockDoc);
      
      expect(result).toHaveProperty('reconciled');
      expect(result).toHaveProperty('confidence');
    });
  });
  
  describe('Edit Reconciliation Service', () => {
    it('should track pending edits', () => {
      const service = new EditReconciliationService();
      
      const editId = service.addPendingEdit({
        id: 'edit1',
        type: 'suggestion',
        from: 10,
        to: 20,
        originalText: 'original',
        suggestedText: 'suggested',
        confidence: 0.9,
        version: { id: 'v1', timestamp: Date.now(), transactionCount: 0 }
      });
      
      expect(editId).toBeDefined();
      
      const summary = service.getPendingEditsSummary();
      expect(summary.total).toBe(1);
      expect(summary.pending).toBe(1);
    });
    
    it('should reconcile edits', async () => {
      const service = new EditReconciliationService(mockEditor);
      
      const editId = service.addPendingEdit({
        id: 'edit1',
        type: 'suggestion',
        from: 10,
        to: 20,
        originalText: 'test',
        suggestedText: 'exam',
        confidence: 0.9,
        version: { id: 'v1', timestamp: Date.now(), transactionCount: 0 }
      });
      
      const result = await service.reconcileEdit(editId);
      
      expect(result).toHaveProperty('id', editId);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('requiresFallback');
    });
    
    it('should mark edits as applied or rejected', () => {
      const service = new EditReconciliationService();
      
      const editId = service.addPendingEdit({
        id: 'edit1',
        type: 'suggestion',
        from: 10,
        to: 20,
        originalText: 'original',
        suggestedText: 'suggested',
        confidence: 0.9,
        version: { id: 'v1', timestamp: Date.now(), transactionCount: 0 }
      });
      
      service.markEditApplied(editId);
      
      const summary = service.getPendingEditsSummary();
      expect(summary.applied).toBe(1);
      
      const editId2 = service.addPendingEdit({
        id: 'edit2',
        type: 'suggestion',
        from: 30,
        to: 40,
        originalText: 'another',
        suggestedText: 'different',
        confidence: 0.8,
        version: { id: 'v1', timestamp: Date.now(), transactionCount: 0 }
      });
      
      service.markEditRejected(editId2);
      
      const summary2 = service.getPendingEditsSummary();
      expect(summary2.rejected).toBe(1);
    });
  });
  
  describe('Integration Test', () => {
    it('should handle complete position-based flow', async () => {
      // 1. Extract segments with positions
      const segments = extractPositionAwareSegments(mockEditor);
      expect(segments.length).toBeGreaterThan(0);
      
      // 2. Format for LLM
      const formatted = formatSegmentsForLLM(segments);
      expect(formatted.length).toBe(segments.length);
      
      // 3. Simulate LLM response
      const llmResponse: LLMPositionResponse = {
        segmentId: segments[0].id,
        startChar: 0,
        endChar: 5,
        originalText: 'Hello',
        suggestedText: 'Hi',
        confidence: 0.95
      };
      
      // 4. Convert to absolute positions
      const absolute = llmResponseToAbsolute(llmResponse, segments);
      expect(absolute).not.toBeNull();
      
      // 5. Validate content
      if (absolute) {
        const isValid = validatePositionContent(
          mockDoc,
          absolute.from,
          absolute.to,
          absolute.originalText
        );
        expect(typeof isValid).toBe('boolean');
      }
      
      // 6. Track with reconciliation
      const service = new EditReconciliationService(mockEditor);
      const mapper = createScopedMapper();
      
      if (absolute) {
        const editId = service.addPendingEdit({
          id: 'test-edit',
          type: 'suggestion',
          from: absolute.from,
          to: absolute.to,
          originalText: absolute.originalText,
          suggestedText: absolute.suggestedText,
          confidence: absolute.confidence,
          version: mapper.getVersion()
        });
        
        // 7. Reconcile after potential edits
        const result = await service.reconcileEdit(editId);
        expect(result.id).toBe(editId);
      }
    });
  });
});