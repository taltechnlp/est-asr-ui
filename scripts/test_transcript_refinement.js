#!/usr/bin/env node

/**
 * Test script for the Transcript Refinement Workflow
 * This script tests the complete pipeline from file loading to AI analysis
 */

import { TranscriptRefinementAgent } from '../src/lib/agent/transcriptRefinementAgent.js';

// Sample transcript data for testing
const sampleTranscript = {
  content: [
    {
      type: 'segment',
      attrs: {
        id: 'speaker_1',
        'data-name': 'Speaker 1',
        start: 0,
        end: 5000
      },
      content: [
        {
          type: 'text',
          text: 'Tallinna Ülikooli rektor Tiit Land.',
          marks: [
            {
              type: 'word',
              attrs: { start: 0, end: 1000, id: 'word_1' }
            }
          ]
        }
      ]
    },
    {
      type: 'segment',
      attrs: {
        id: 'speaker_2',
        'data-name': 'Speaker 2',
        start: 5000,
        end: 10000
      },
      content: [
        {
          type: 'text',
          text: 'Eesti Teaduste Akadeemia president.',
          marks: [
            {
              type: 'word',
              attrs: { start: 5000, end: 6000, id: 'word_2' }
            }
          ]
        }
      ]
    }
  ]
};

const sampleWords = [
  { start: 0, end: 1000, id: 'word_1' },
  { start: 5000, end: 6000, id: 'word_2' }
];

const sampleSpeakers = [
  { name: 'Speaker 1', id: 'speaker_1', start: 0, end: 5000 },
  { name: 'Speaker 2', id: 'speaker_2', start: 5000, end: 10000 }
];

async function testTranscriptRefinement() {
  console.log('🧪 Testing Transcript Refinement Workflow with Real OpenRouter...\n');

  try {
    // Initialize the agent with real LLM (not mock mode)
    console.log('📋 Initializing Transcript Refinement Agent...');
    const agent = new TranscriptRefinementAgent(false); // Use real OpenRouter
    console.log('✅ Agent initialized successfully (real OpenRouter mode)\n');

    // Test segment analysis with a small segment
    console.log('🔍 Testing individual segment analysis...');
    const segmentAnalysis = await agent.analyzeSegment(
      'Tallinna Ülikooli rektor Tiit Land.',
      'test_segment_1',
      0,
      5000,
      'Speaker 1'
    );

    console.log('✅ Segment analysis completed');
    console.log(`📊 Confidence: ${segmentAnalysis.confidence}`);
    console.log(`🔧 Issues found: ${segmentAnalysis.issues.length}`);
    console.log(`✏️  Corrections suggested: ${segmentAnalysis.corrections.length}`);
    console.log(`🏷️  NER entities: ${segmentAnalysis.nerAnalysis.entities?.length || 0}`);
    
    if (segmentAnalysis.llmSuggestions.length > 0) {
      console.log(`🤖 LLM Analysis: ${segmentAnalysis.llmSuggestions[0].substring(0, 200)}...`);
    }
    
    if (segmentAnalysis.corrections.length > 0) {
      console.log('📝 Suggested corrections:');
      segmentAnalysis.corrections.forEach((correction, index) => {
        console.log(`  ${index + 1}. "${correction.original}" → "${correction.suggested}" (${(correction.confidence * 100).toFixed(0)}%)`);
        console.log(`     Reason: ${correction.reasoning}`);
      });
    }
    console.log('');

    // Test full transcript refinement with small segments
    console.log('🚀 Testing full transcript refinement...');
    const result = await agent.refineTranscript(
      'test_file_123',
      sampleWords,
      sampleSpeakers,
      sampleTranscript
    );

    console.log('✅ Full transcript refinement completed');
    console.log(`📊 Summary:`);
    console.log(`   - Total segments: ${result.totalSegments}`);
    console.log(`   - Segments with issues: ${result.segmentsWithIssues}`);
    console.log(`   - Total corrections: ${result.summary.totalCorrections}`);
    console.log(`   - High priority issues: ${result.summary.highPriorityIssues}`);
    console.log(`   - Processing time: ${(result.processingTime / 1000).toFixed(1)}s\n`);

    // Display detailed results
    console.log('📋 Detailed Results:');
    result.segments.forEach((segment, index) => {
      console.log(`\n${index + 1}. Segment "${segment.segmentId}":`);
      console.log(`   Speaker: ${segment.speaker}`);
      console.log(`   Text: "${segment.text}"`);
      console.log(`   Confidence: ${segment.confidence}`);
      console.log(`   Issues: ${segment.issues.length}`);
      console.log(`   Corrections: ${segment.corrections.length}`);
      
      if (segment.corrections.length > 0) {
        console.log('   Suggested corrections:');
        segment.corrections.forEach((correction, cIndex) => {
          console.log(`     ${cIndex + 1}. "${correction.original}" → "${correction.suggested}" (${(correction.confidence * 100).toFixed(0)}%)`);
          console.log(`        Reason: ${correction.reasoning}`);
        });
      }
    });

    console.log('\n🎉 All tests completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testTranscriptRefinement()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testTranscriptRefinement }; 