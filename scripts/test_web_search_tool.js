// Test script for Web Search Tool
// This script demonstrates the web search tool functionality for ASR transcript verification

import { WebSearchTool } from '../src/lib/agent/webSearchTool.js';

async function testWebSearchTool() {
    console.log('🧪 Testing Web Search Tool for ASR Agent...\n');

    // Create web search tool instance
    const webSearchTool = new WebSearchTool({
        searchProvider: 'duckduckgo' // Use DuckDuckGo for free testing (no API key required)
    });

    // Test queries related to Estonian entities (similar to ASR output)
    const testQueries = [
        {
            description: 'Estonian University Rector',
            query: 'Tallinna Ülikooli rektor',
            context: 'Estonian university rector'
        },
        {
            description: 'Estonian Academy of Sciences',
            query: 'Eesti Teaduste Akadeemia',
            context: 'Estonia academy sciences'
        },
        {
            description: 'Tartu University',
            query: 'Tartu Ülikool professor',
            context: 'Estonia university professor'
        }
    ];

    console.log(`📋 Running ${testQueries.length} test queries...\n`);

    for (let i = 0; i < testQueries.length; i++) {
        const test = testQueries[i];
        console.log(`🔍 Test ${i + 1}: ${test.description}`);
        console.log(`   Query: "${test.query}"`);
        console.log(`   Context: "${test.context}"`);
        
        try {
            const startTime = Date.now();
            
            // Prepare input for the tool
            const searchInput = JSON.stringify({
                query: test.query,
                context: test.context,
                maxResults: 3
            });
            
            // Call the web search tool
            const result = await webSearchTool.call(searchInput);
            const duration = Date.now() - startTime;
            
            console.log(`   ✅ Search completed in ${duration}ms`);
            console.log(`   📄 Result (first 300 chars):`);
            console.log(`   ${result.substring(0, 300)}...`);
            
            // Check if entities were verified
            const hasVerifiedEntities = result.includes('✅');
            const hasUnverifiedEntities = result.includes('❌');
            
            console.log(`   📊 Verification: ${hasVerifiedEntities ? 'Some entities verified' : 'No verified entities'}`);
            if (hasUnverifiedEntities) {
                console.log(`   ⚠️  Some entities could not be verified`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
        
        // Add delay between requests to be respectful to the API
        if (i < testQueries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('🧪 Web Search Tool testing completed!\n');

    // Test the static helper methods
    console.log('🔧 Testing static helper methods...\n');

    try {
        console.log('🔍 Testing entity verification...');
        const entityResult = await WebSearchTool.verifyEntity('Tallinna Ülikool', 'Estonian university');
        console.log(`   Entity verification result:`, entityResult);
    } catch (error) {
        console.log(`   ❌ Entity verification error: ${error.message}`);
    }

    try {
        console.log('🔍 Testing fact verification...');
        const factResult = await WebSearchTool.verifyFact('Tallinn is the capital of Estonia', 'Estonia geography');
        console.log(`   Fact verification result:`, factResult);
    } catch (error) {
        console.log(`   ❌ Fact verification error: ${error.message}`);
    }

    console.log('\n✅ All tests completed!');
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    testWebSearchTool()
        .then(() => {
            console.log('🎉 Test script finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test script failed:', error);
            process.exit(1);
        });
}

export { testWebSearchTool }; 