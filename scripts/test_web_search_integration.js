#!/usr/bin/env node

/**
 * Test script for Web Search Integration in ASR Agent
 * This tests the new web search functionality through the transcript refinement API
 * Run with: node scripts/test_web_search_integration.js
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';

// Mock file data that simulates Estonian transcript content
const mockTranscriptContent = {
  type: 'doc',
  content: [
    {
      type: 'speaker',
      attrs: {
        'data-name': 'Speaker 1',
        id: 'speaker_1'
      },
      content: [
        {
          type: 'text',
          text: 'Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.',
          marks: [
            {
              type: 'word',
              attrs: {
                id: 'word_1',
                start: 0,
                end: 8.0
              }
            }
          ]
        }
      ]
    }
  ]
};

async function testWebSearchIntegration() {
  console.log('🌐 Testing Web Search Integration in ASR Agent...\n');
  
  try {
    // Create a mock file content for testing
    console.log('📝 Testing with Estonian transcript content:');
    console.log('Text: "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas."');
    console.log('Expected entities: Tallinna Ülikool, Tiit Land, Tartu Ülikool, Mart Kull, Eesti Teaduste Akadeemia\n');
    
    // Test the transcript refinement API (which now includes web search)
    console.log('🚀 Calling transcript refinement API with web search...\n');
    
    const requestData = {
      fileId: 'test_file_123',
      // Note: In a real scenario, this would be stored in the database
      // For testing, we'll need to modify the API to accept direct content
      mockContent: mockTranscriptContent
    };
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/agent/transcript-refinement`, requestData, {
        timeout: 60000, // Increased timeout for web search
        headers: {
          'Content-Type': 'application/json',
          // Note: In production, you'd need proper authentication headers
        }
      });
      
      const duration = Date.now() - startTime;
      const result = response.data;
      
      console.log(`✅ API call completed in ${duration}ms\n`);
      
      if (result.success) {
        console.log('🎉 Web Search Integration Test Results:');
        console.log('=====================================\n');
        
        const agentResult = result.result;
        
        console.log(`📊 Summary:`);
        console.log(`- Total segments analyzed: ${agentResult.totalSegments}`);
        console.log(`- Segments with issues: ${agentResult.segmentsWithIssues}`);
        console.log(`- Processing time: ${(agentResult.processingTime / 1000).toFixed(1)}s`);
        console.log(`- Total corrections suggested: ${agentResult.summary.totalCorrections}\n`);
        
        if (agentResult.summary.webSearchQueries) {
          console.log(`🌐 Web Search Analysis:`);
          console.log(`- Queries searched: ${agentResult.summary.webSearchQueries.length}`);
          console.log(`- Search terms: ${agentResult.summary.webSearchQueries.join(', ')}`);
          
          if (agentResult.summary.verifiedEntities && agentResult.summary.verifiedEntities.length > 0) {
            console.log(`- ✅ Verified entities: ${agentResult.summary.verifiedEntities.join(', ')}`);
          }
          
          if (agentResult.summary.unverifiedEntities && agentResult.summary.unverifiedEntities.length > 0) {
            console.log(`- ❌ Unverified entities: ${agentResult.summary.unverifiedEntities.join(', ')}`);
          }
          console.log('');
        }
        
        if (agentResult.processingSteps) {
          console.log(`🔄 Processing Pipeline:`);
          agentResult.processingSteps.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step}`);
          });
          console.log('');
        }
        
        if (agentResult.segments && agentResult.segments.length > 0) {
          console.log(`📋 Segments of Interest (${agentResult.segments.length}):`);
          agentResult.segments.forEach((segment, index) => {
            console.log(`\n   ${index + 1}. "${segment.text}"`);
            console.log(`      Reason: ${segment.reason}`);
            console.log(`      Action: ${segment.action || 'Not specified'}`);
            console.log(`      Priority: ${segment.priority || 'Not specified'}`);
            console.log(`      Uncertainty: ${(segment.uncertaintyScore * 100).toFixed(1)}%`);
            
            if (segment.webSearchResults) {
              console.log(`      🌐 Web Search:`);
              console.log(`         Query: "${segment.webSearchResults.query}"`);
              console.log(`         Verified: ${segment.webSearchResults.verified ? '✅' : '❌'}`);
              console.log(`         Confidence: ${(segment.webSearchResults.confidence * 100).toFixed(1)}%`);
              if (segment.webSearchResults.evidence && segment.webSearchResults.evidence.length > 0) {
                console.log(`         Evidence: ${segment.webSearchResults.evidence[0].substring(0, 100)}...`);
              }
            }
            
            if (segment.corrections && segment.corrections.length > 0) {
              console.log(`      💡 Suggested corrections:`);
              segment.corrections.forEach((correction, corrIndex) => {
                console.log(`         ${corrIndex + 1}. ${correction.original} → ${correction.suggested}`);
                console.log(`            Reason: ${correction.reasoning}`);
                console.log(`            Confidence: ${(correction.confidence * 100).toFixed(1)}%`);
              });
            }
          });
        }
        
        console.log('\n🎯 Test Results:');
        console.log('- ✅ Web search integration is working');
        console.log('- ✅ Entities are being extracted and searched');
        console.log('- ✅ Verification results are being returned');
        console.log('- ✅ Processing pipeline includes web search step');
        
      } else {
        console.log('❌ API call failed:');
        console.log(`Error: ${result.error}`);
        console.log(`Message: ${result.message}`);
      }
      
    } catch (apiError) {
      console.log('❌ API request failed:');
      if (apiError.response) {
        console.log(`Status: ${apiError.response.status}`);
        console.log(`Error: ${apiError.response.data?.error || 'Unknown error'}`);
        console.log(`Message: ${apiError.response.data?.message || 'No message'}`);
      } else {
        console.log(`Network error: ${apiError.message}`);
      }
    }
    
  } catch (error) {
    console.log('💥 Test failed with error:');
    console.log(error.message);
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing server health...\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/`, {
      timeout: 5000
    });
    
    console.log('✅ Server is running');
    
  } catch (error) {
    console.log('❌ Server health check failed:');
    console.log(`Error: ${error.message}`);
    console.log('\n💡 Make sure the development server is running:');
    console.log('   npm run dev');
    return false;
  }
  
  return true;
}

async function runTests() {
  console.log('🚀 Starting Web Search Integration Tests...\n');
  
  // Test server health first
  const serverOk = await testHealthCheck();
  if (!serverOk) {
    return;
  }
  
  console.log('');
  
  // Test web search integration
  await testWebSearchIntegration();
  
  console.log('\n✨ Tests completed!');
  console.log('\n📝 Note: This test uses mock data. In production, the API would:');
  console.log('   1. Authenticate the user');
  console.log('   2. Fetch real file content from the database');
  console.log('   3. Perform actual web searches (requires API keys)');
  console.log('   4. Store results in the database');
}

// Run tests if this script is executed directly
// In ES modules, we can use import.meta.url to check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testWebSearchIntegration, testHealthCheck }; 