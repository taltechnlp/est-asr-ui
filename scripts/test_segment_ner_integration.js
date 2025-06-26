#!/usr/bin/env node

/**
 * Test script for Segment Extraction with NER Integration
 * Run with: node scripts/test_segment_ner_integration.js
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';

// Test configurations
const testConfigs = [
  {
    name: "NER Tool Only Test",
    endpoint: "/api/agent/test-segment-ner",
    method: "POST",
    data: {
      testType: "ner-only",
      customText: "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professoriga."
    }
  },
  {
    name: "Segment Extraction Test",
    endpoint: "/api/agent/test-segment-ner",
    method: "POST",
    data: {
      testType: "segment-extraction"
    }
  },
  {
    name: "Full Integration Test",
    endpoint: "/api/agent/test-segment-ner",
    method: "POST",
    data: {
      testType: "full"
    }
  },
  {
    name: "Custom Text NER Test",
    endpoint: "/api/agent/test-segment-ner",
    method: "POST",
    data: {
      testType: "ner-only",
      customText: "Eesti Teaduste Akadeemia president Tarmo Soomere esines konverentsil."
    }
  }
];

async function runTest(testConfig) {
  console.log(`\n🧪 Running: ${testConfig.name}`);
  console.log('='.repeat(60));
  
  try {
    const response = await axios({
      method: testConfig.method,
      url: `${API_BASE_URL}${testConfig.endpoint}`,
      data: testConfig.data,
      timeout: 60000, // 60 seconds timeout for full integration
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = response.data;
    
    if (result.success) {
      console.log('✅ Test passed!');
      console.log(`📊 Test Type: ${result.testType}`);
      
      // Display relevant results based on test type
      if (result.testType === 'ner-only') {
        console.log(`📝 Input Text: "${result.result.inputText}"`);
        console.log(`🔍 NER Result Length: ${result.result.nerResult.length} characters`);
        console.log(`📋 Has Issues: ${result.result.nerResult.includes('🔴') || result.result.nerResult.includes('🟡') ? 'Yes' : 'No'}`);
        
        // Show a preview of the NER result
        const preview = result.result.nerResult.substring(0, 300);
        console.log(`📄 NER Result Preview:\n${preview}...`);
      }
      
      if (result.testType === 'segment-extraction') {
        console.log(`📄 Transcript: "${result.result.asrOutput.transcript}"`);
        console.log(`📊 Total Segments: ${result.result.asrOutput.segmentCount}`);
        console.log(`🎯 Segments of Interest: ${result.result.segmentsOfInterest.length}`);
        
        if (result.result.segmentsOfInterest.length > 0) {
          console.log('\n📋 Segments with Issues:');
          result.result.segmentsOfInterest.forEach((segment, index) => {
            console.log(`  ${index + 1}. "${segment.text}" (${segment.reason})`);
            console.log(`     Uncertainty: ${segment.uncertaintyScore.toFixed(2)}`);
            if (segment.nerEntities && segment.nerEntities.length > 0) {
              console.log(`     NER Entities: ${segment.nerEntities.length}`);
            }
          });
        }
      }
      
      if (result.testType === 'full') {
        console.log(`📄 Full Transcript: "${result.result.asrOutput.transcript}"`);
        console.log(`📊 Total Segments: ${result.result.asrOutput.totalSegments}`);
        console.log(`🔍 Segments with Issues: ${result.result.asrOutput.segmentsWithIssues}`);
        
        if (result.result.segmentAnalysis && result.result.segmentAnalysis.segments.length > 0) {
          console.log('\n📋 Segment Analysis:');
          result.result.segmentAnalysis.segments.forEach((segment, index) => {
            console.log(`  ${index + 1}. "${segment.text}"`);
            console.log(`     Words: ${segment.wordCount}, Confidence: ${segment.confidence.toFixed(2)}`);
          });
        }
        
        if (result.result.segmentsOfInterest.length > 0) {
          console.log('\n🎯 NER-Specific Issues:');
          result.result.segmentsOfInterest.forEach((segment, index) => {
            console.log(`  ${index + 1}. "${segment.text}"`);
            console.log(`     Priority: ${segment.priority}, Uncertainty: ${segment.uncertaintyScore.toFixed(2)}`);
            if (segment.nerEntities && segment.nerEntities.length > 0) {
              console.log(`     NER Entities: ${segment.nerEntities.length}`);
              segment.nerEntities.forEach(entity => {
                console.log(`       - "${entity.text}" (${entity.label}) - ${entity.confidence} confidence`);
              });
            }
          });
        }
      }
      
    } else {
      console.log('❌ Test failed!');
      console.log(`Error: ${result.message}`);
      if (result.error) {
        console.log(`Details: ${result.error}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Test failed with exception!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error: ${error.response.data?.message || error.message}`);
      if (error.response.data?.error) {
        console.log(`Details: ${error.response.data.error}`);
      }
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing health check...\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/agent/test-segment-ner`, {
      timeout: 10000
    });
    
    console.log('✅ Health check passed!');
    console.log('📊 System Status:', response.data.message);
    console.log('🔧 Available Tests:', response.data.availableTests.join(', '));
    
    if (response.data.quickTest) {
      console.log('⚡ Quick Test Results:');
      console.log(`  Input: "${response.data.quickTest.input}"`);
      console.log(`  Has Result: ${response.data.quickTest.hasResult}`);
      console.log(`  Result Length: ${response.data.quickTest.resultLength}`);
    }
    
  } catch (error) {
    console.log('❌ Health check failed!');
    console.log(error.response?.data?.message || error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Segment Extraction with NER Integration Tests...\n');
  
  // First, run health check
  await testHealthCheck();
  
  // Then run all test configurations
  for (const testConfig of testConfigs) {
    await runTest(testConfig);
    
    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ All tests completed!');
  console.log('\n📋 Summary:');
  console.log('- NER Tool: Tests direct NER functionality');
  console.log('- Segment Extraction: Tests ASR to segment conversion');
  console.log('- Full Integration: Tests complete pipeline with NER analysis');
  console.log('- Custom Text: Tests NER with specific Estonian text');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testHealthCheck }; 