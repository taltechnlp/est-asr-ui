// Test script for the new LangGraph ASR Agent
// This tests the graph-based agent architecture

import { processAudioWithLangGraph } from '../src/lib/agent/langGraphAgent.js';
import { getSimpleASRAgent } from '../src/lib/agent/simpleAgent.js';

async function testLangGraphAgent() {
  console.log('🧪 Testing LangGraph ASR Agent vs SimpleASRAgent');
  console.log('=' .repeat(60));

  try {
    // Test the new LangGraph agent
    console.log('\n🔗 Testing LangGraph Agent...');
    const langGraphStart = Date.now();
    const langGraphResult = await processAudioWithLangGraph('test_audio.wav', 'et');
    const langGraphTime = Date.now() - langGraphStart;

    console.log('\n📊 LangGraph Results:');
    console.log(`   - Processing time: ${langGraphTime}ms`);
    console.log(`   - Transcript: "${langGraphResult.transcript.substring(0, 100)}..."`);
    console.log(`   - Segments of interest: ${langGraphResult.segmentsOfInterest.length}`);
    console.log(`   - Processing steps: ${langGraphResult.processingSteps.length}`);
    console.log(`   - Total segments: ${langGraphResult.totalSegments}`);
    console.log(`   - Segments with issues: ${langGraphResult.segmentsWithIssues}`);
    
    if (langGraphResult.webSearchContext) {
      console.log(`   - Web search context available: ${langGraphResult.webSearchContext.substring(0, 200)}...`);
    }

    console.log('\n📋 Processing Steps:');
    langGraphResult.processingSteps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });

    console.log('\n🔍 Segments of Interest:');
    langGraphResult.segmentsOfInterest.slice(0, 3).forEach((segment, i) => {
      console.log(`   ${i + 1}. "${segment.text}" (${segment.reason}, uncertainty: ${segment.uncertaintyScore.toFixed(2)})`);
      if (segment.webSearchResults) {
        console.log(`      Web search: ${segment.webSearchResults.verified ? '✅' : '❌'} "${segment.webSearchResults.query}"`);
      }
    });

    // Test the old SimpleASRAgent for comparison
    console.log('\n\n🔄 Testing SimpleASRAgent for comparison...');
    const simpleStart = Date.now();
    const simpleAgent = await getSimpleASRAgent();
    const simpleResult = await simpleAgent.processAudio('test_audio.wav');
    const simpleTime = Date.now() - simpleStart;

    console.log('\n📊 SimpleASRAgent Results:');
    console.log(`   - Processing time: ${simpleTime}ms`);
    console.log(`   - Transcript: "${simpleResult.transcript.substring(0, 100)}..."`);
    console.log(`   - Segments of interest: ${simpleResult.segmentsOfInterest.length}`);
    console.log(`   - Processing steps: ${simpleResult.processingSteps.length}`);
    
    if (simpleResult.webSearchContext) {
      console.log(`   - Web search context available: ${simpleResult.webSearchContext.substring(0, 200)}...`);
    }

    // Comparison
    console.log('\n📈 Comparison:');
    console.log(`   - Performance: LangGraph ${langGraphTime}ms vs SimpleASRAgent ${simpleTime}ms`);
    console.log(`   - Segments found: LangGraph ${langGraphResult.segmentsOfInterest.length} vs SimpleASRAgent ${simpleResult.segmentsOfInterest.length}`);
    console.log(`   - Steps: LangGraph ${langGraphResult.processingSteps.length} vs SimpleASRAgent ${simpleResult.processingSteps.length}`);

    const percentageDiff = ((langGraphTime - simpleTime) / simpleTime * 100).toFixed(1);
    if (langGraphTime > simpleTime) {
      console.log(`   - LangGraph is ${percentageDiff}% slower (graph overhead expected)`);
    } else {
      console.log(`   - LangGraph is ${Math.abs(Number(percentageDiff))}% faster`);
    }

    console.log('\n✅ Test completed successfully!');
    
    return {
      langGraph: langGraphResult,
      simple: simpleResult,
      performance: {
        langGraphTime,
        simpleTime,
        percentageDiff: Number(percentageDiff)
      }
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Additional test for graph state management
async function testGraphStateManagement() {
  console.log('\n🔄 Testing LangGraph State Management...');
  
  try {
    // Test with different languages
    const languages = ['et', 'en', 'fi'];
    
    for (const lang of languages) {
      console.log(`\n🌐 Testing with language: ${lang}`);
      const result = await processAudioWithLangGraph('test_audio.wav', lang);
      
      console.log(`   - Processed ${result.processingSteps.length} steps`);
      console.log(`   - Found ${result.segmentsOfInterest.length} segments`);
      console.log(`   - Processing time: ${result.processingTime}ms`);
    }

    console.log('\n✅ State management test completed!');
    
  } catch (error) {
    console.error('❌ State management test failed:', error);
    throw error;
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting LangGraph Agent Tests');
  console.log('=' .repeat(60));

  try {
    await testLangGraphAgent();
    await testGraphStateManagement();
    
    console.log('\n🎉 All tests passed!');
    console.log('LangGraph ASR Agent is ready for production use.');
    
  } catch (error) {
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testLangGraphAgent, testGraphStateManagement }; 