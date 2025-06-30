// Test LangGraph Agent via API endpoint
// This tests the new graph-based agent through the transcript refinement API

import fetch from 'node-fetch';

async function testLangGraphViaAPI() {
  console.log('🧪 Testing LangGraph Agent via API');
  console.log('=' .repeat(50));

  const baseUrl = 'http://localhost:5173';
  
  try {
    // Check if server is running
    console.log('🔍 Checking if development server is running...');
    
    try {
      const healthCheck = await fetch(`${baseUrl}/api/agent/test`);
      console.log(`✅ Server is running (status: ${healthCheck.status})`);
    } catch (error) {
      console.log('❌ Server not responding. Please run "npm run dev" first.');
      console.log('   Then test manually by visiting a file page in the browser.');
      return;
    }

    console.log('\n📋 Test Instructions:');
    console.log('1. Visit http://localhost:5173 in your browser');
    console.log('2. Sign in or create an account');
    console.log('3. Upload a test audio file or use an existing file');
    console.log('4. Open the file page to trigger the LangGraph agent');
    console.log('5. Check the browser console and server logs for LangGraph output');
    
    console.log('\n🔍 Look for these log messages in the server console:');
    console.log('   - "🚀 LangGraphAgent: Starting audio processing..."');
    console.log('   - "📋 LangGraphAgent: Starting ASR transcription"');
    console.log('   - "📋 LangGraphAgent: Starting web search analysis"');
    console.log('   - "📋 LangGraphAgent: Starting NER analysis"');
    console.log('   - "📋 LangGraphAgent: Starting error detection"');
    console.log('   - "📋 LangGraphAgent: Starting segment categorization"');
    console.log('   - "✅ LangGraphAgent: Processing completed in XXXms"');

    console.log('\n🔗 Expected LangGraph Flow:');
    console.log('   START → ASR → Web Search → NER → Error Detection → Categorization → END');
    
    console.log('\n📊 What to verify:');
    console.log('   - Web search analysis shows Estonian entities being searched');
    console.log('   - Processing steps appear in order');
    console.log('   - Segments of interest are identified and categorized');
    console.log('   - The UI shows processing steps and web search results');

    console.log('\n✅ Manual testing setup complete!');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
  }
}

// Alternative: Test with a mock API call if we have session handling
async function testWithMockData() {
  console.log('\n🔬 Testing with mock transcript data...');
  
  const mockTranscript = {
    type: "doc",
    content: [
      {
        type: "speaker",
        attrs: {
          id: "speaker_1",
          "data-name": "Speaker 1"
        },
        content: [
          {
            type: "text",
            text: "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professor Mart Kulliga Eesti Teaduste Akadeemias. Nad arutasid koostööd tehisintellekti valdkonnas.",
            marks: [
              {
                type: "word",
                attrs: {
                  id: "word_1",
                  start: 0,
                  end: 0.8
                }
              }
            ]
          }
        ]
      }
    ]
  };

  console.log('📝 Mock transcript created with Estonian entities:');
  console.log('   - Tallinna Ülikooli rektor Tiit Land');
  console.log('   - Tartu Ülikooli professor Mart Kullig');
  console.log('   - Eesti Teaduste Akadeemia');
  
  console.log('\n🎯 Expected LangGraph behavior:');
  console.log('   1. Extract entities from transcript');
  console.log('   2. Generate search queries for verification');
  console.log('   3. Use intelligent context generation');
  console.log('   4. Perform web searches with DuckDuckGo fallback');
  console.log('   5. Categorize segments based on verification results');
  
  return mockTranscript;
}

// Show LangGraph advantages
function showLangGraphAdvantages() {
  console.log('\n🚀 LangGraph Agent Advantages:');
  console.log('=' .repeat(50));
  
  console.log('\n📈 Better Architecture:');
  console.log('   ✅ Clear separation of concerns (each node has one responsibility)');
  console.log('   ✅ Explicit state management between processing steps');
  console.log('   ✅ Better error handling and recovery');
  console.log('   ✅ Easier to debug and monitor each step');
  
  console.log('\n🔄 Improved Flow Control:');
  console.log('   ✅ Graph-based execution with clear dependencies');
  console.log('   ✅ Conditional branching capabilities (future enhancement)');
  console.log('   ✅ Parallel execution potential');
  console.log('   ✅ Easier to add/remove processing steps');
  
  console.log('\n🛠️ Development Benefits:');
  console.log('   ✅ Type-safe state management');
  console.log('   ✅ Modular node design for easier testing');
  console.log('   ✅ Better observability of processing pipeline');
  console.log('   ✅ Preparation for more complex workflows');
  
  console.log('\n🔮 Future Enhancements:');
  console.log('   🚧 Conditional routing (skip steps based on confidence)');
  console.log('   🚧 Parallel processing of multiple transcripts');
  console.log('   🚧 Dynamic workflow adjustment based on results');
  console.log('   🚧 Integration with human-in-the-loop feedback');
}

// Main test function
async function runTests() {
  console.log('🔗 LangGraph ASR Agent Test Suite');
  console.log('=' .repeat(60));
  
  await testLangGraphViaAPI();
  testWithMockData();
  showLangGraphAdvantages();
  
  console.log('\n🎉 Test suite completed!');
  console.log('Open your browser and test the agent manually.');
}

runTests(); 