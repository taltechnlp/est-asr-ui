import type { Editor } from '@tiptap/core';
import { createEditorSnapshot, searchInSnapshot, logEditorSnapshot, type EditorSnapshot } from './editorDebugger';
import { findAndReplaceTextSimple } from './transcriptTextReplaceProseMirrorSimple';
import { findAndReplaceText } from './transcriptTextReplaceProseMirror';

export interface TestCase {
  id: string;
  description: string;
  searchText: string;
  replacementText: string;
  expectedToFind: boolean;
  segmentId?: string;
  notes?: string;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  method: 'simple' | 'prosemirror' | 'none';
  error?: string;
  snapshot?: EditorSnapshot;
  searchResults?: ReturnType<typeof searchInSnapshot>;
  executionTime: number;
}

/**
 * Test harness for text replacement functionality
 */
export class TextReplacementTestHarness {
  private editor: Editor;
  private results: TestResult[] = [];
  private verbose: boolean;
  
  constructor(editor: Editor, verbose: boolean = true) {
    this.editor = editor;
    this.verbose = verbose;
  }
  
  /**
   * Run a single test case
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    const startTime = performance.now();
    
    if (this.verbose) {
      console.group(`🧪 Test: ${testCase.id} - ${testCase.description}`);
      console.log('Search for:', JSON.stringify(testCase.searchText));
      console.log('Replace with:', JSON.stringify(testCase.replacementText));
      console.log('Expected to find:', testCase.expectedToFind);
    }
    
    // Take snapshot before
    const snapshot = createEditorSnapshot(this.editor);
    const searchResults = searchInSnapshot(snapshot, testCase.searchText);
    
    if (this.verbose) {
      console.log('Search analysis:', {
        found: searchResults.found,
        exactMatch: searchResults.exactMatch,
        locations: searchResults.locations.length,
        foundWords: searchResults.wordAnalysis.foundWords,
        missingWords: searchResults.wordAnalysis.missingWords
      });
    }
    
    // Try simple method first
    const simpleResult = findAndReplaceTextSimple(
      this.editor,
      testCase.searchText,
      testCase.replacementText,
      {
        caseSensitive: false,
        segmentId: testCase.segmentId
      }
    );
    
    let result: TestResult;
    
    if (simpleResult.success) {
      result = {
        testId: testCase.id,
        passed: testCase.expectedToFind,
        method: 'simple',
        snapshot,
        searchResults,
        executionTime: performance.now() - startTime
      };
      
      if (this.verbose) {
        console.log('✅ Simple method succeeded');
      }
    } else {
      // Try prosemirror utils method
      const pmResult = findAndReplaceText(
        this.editor,
        testCase.searchText,
        testCase.replacementText,
        {
          caseSensitive: false,
          segmentId: testCase.segmentId
        }
      );
      
      if (pmResult.success) {
        result = {
          testId: testCase.id,
          passed: testCase.expectedToFind,
          method: 'prosemirror',
          snapshot,
          searchResults,
          executionTime: performance.now() - startTime
        };
        
        if (this.verbose) {
          console.log('✅ ProseMirror utils method succeeded');
        }
      } else {
        result = {
          testId: testCase.id,
          passed: !testCase.expectedToFind, // Pass if we expected not to find
          method: 'none',
          error: pmResult.error || simpleResult.error,
          snapshot,
          searchResults,
          executionTime: performance.now() - startTime
        };
        
        if (this.verbose) {
          console.log('❌ Both methods failed');
          console.log('Simple error:', simpleResult.error);
          console.log('PM error:', pmResult.error);
        }
      }
    }
    
    if (this.verbose) {
      console.log(`Execution time: ${result.executionTime.toFixed(2)}ms`);
      console.groupEnd();
    }
    
    this.results.push(result);
    return result;
  }
  
  /**
   * Run multiple test cases
   */
  async runTests(testCases: TestCase[]): Promise<TestResult[]> {
    console.group('🔬 Running Text Replacement Tests');
    console.log(`Running ${testCases.length} tests...`);
    
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.printSummary();
    console.groupEnd();
    
    return results;
  }
  
  /**
   * Print test summary
   */
  printSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const byMethod = {
      simple: this.results.filter(r => r.method === 'simple').length,
      prosemirror: this.results.filter(r => r.method === 'prosemirror').length,
      none: this.results.filter(r => r.method === 'none').length
    };
    
    console.group('📊 Test Summary');
    console.log(`Total: ${this.results.length} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('Methods used:', byMethod);
    
    if (failed > 0) {
      console.group('Failed tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`- ${r.testId}: ${r.error || 'Unknown error'}`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }
  
  /**
   * Get all results
   */
  getResults(): TestResult[] {
    return this.results;
  }
  
  /**
   * Clear results
   */
  clearResults() {
    this.results = [];
  }
}

/**
 * Generate test cases from current document
 */
export function generateTestCasesFromDocument(editor: Editor): TestCase[] {
  const snapshot = createEditorSnapshot(editor);
  const testCases: TestCase[] = [];
  
  // Test 1: Single words from the document
  const sampleWords = snapshot.wordNodes
    .slice(0, 10)
    .filter(n => n.text.length > 3)
    .map((node, i) => ({
      id: `single-word-${i}`,
      description: `Single word: "${node.text}"`,
      searchText: node.text.replace(/[.,;:!?]+$/, '').trim(),
      replacementText: `[REPLACED_${i}]`,
      expectedToFind: true,
      notes: `Word at position ${node.position}`
    }));
  
  testCases.push(...sampleWords);
  
  // Test 2: Two consecutive words
  for (let i = 0; i < Math.min(5, snapshot.wordNodes.length - 1); i++) {
    const word1 = snapshot.wordNodes[i].text.replace(/[.,;:!?]+$/, '').trim();
    const word2 = snapshot.wordNodes[i + 1].text.replace(/[.,;:!?]+$/, '').trim();
    
    testCases.push({
      id: `two-words-${i}`,
      description: `Two consecutive words`,
      searchText: `${word1} ${word2}`,
      replacementText: `[TWO_WORDS_${i}]`,
      expectedToFind: true,
      notes: `Words at positions ${snapshot.wordNodes[i].position} and ${snapshot.wordNodes[i + 1].position}`
    });
  }
  
  // Test 3: Phrases from actual text
  const fullText = snapshot.fullText;
  const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
  
  sentences.slice(0, 3).forEach((sentence, i) => {
    const words = sentence.trim().split(/\s+/);
    if (words.length >= 3) {
      const phrase = words.slice(0, 3).join(' ');
      testCases.push({
        id: `phrase-${i}`,
        description: `Three word phrase`,
        searchText: phrase,
        replacementText: `[PHRASE_${i}]`,
        expectedToFind: true,
        notes: `From sentence: "${sentence.substring(0, 50)}..."`
      });
    }
  });
  
  // Test 4: Non-existent text
  testCases.push({
    id: 'non-existent',
    description: 'Text that should not exist',
    searchText: 'XXXXNONEXISTENTXXXX',
    replacementText: '[SHOULD_NOT_REPLACE]',
    expectedToFind: false
  });
  
  // Test 5: Text with punctuation
  const punctuationSamples = snapshot.wordNodes
    .filter(n => /[.,;:!?]/.test(n.text))
    .slice(0, 3);
  
  punctuationSamples.forEach((node, i) => {
    testCases.push({
      id: `punctuation-${i}`,
      description: `Word with punctuation`,
      searchText: node.text,
      replacementText: `[PUNCT_${i}]`,
      expectedToFind: true,
      notes: `Original: "${node.text}"`
    });
  });
  
  return testCases;
}

/**
 * Run automated test suite
 */
export async function runAutomatedTestSuite(editor: Editor): Promise<void> {
  console.log('🚀 Starting Automated Test Suite');
  
  // Log initial state
  logEditorSnapshot(editor, 'Initial State');
  
  // Generate test cases
  const testCases = generateTestCasesFromDocument(editor);
  
  // Create harness and run tests
  const harness = new TextReplacementTestHarness(editor, true);
  await harness.runTests(testCases);
  
  // Export results
  const results = harness.getResults();
  console.log('📁 Test results:', results);
  
  // Log final state
  logEditorSnapshot(editor, 'Final State');
}