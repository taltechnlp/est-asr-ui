#!/usr/bin/env node

/**
 * Test script for the NER API
 * Run with: node scripts/test_ner_api.js
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';

// Sample Estonian texts for testing
const testTexts = [
  {
    name: "Basic Estonian text with entities",
    text: "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professoriga.",
    language: "et"
  },
  {
    name: "Text with potential ASR errors",
    text: "Tallllinna Ülikooli rektor Tiit Landd kohtus Tartuu Ülikooli professoriga.",
    language: "et"
  },
  {
    name: "Text with mixed case issues",
    text: "tallinna ülikooli rektor tiit land kohtus TARTU ÜLIKOOLI professoriga.",
    language: "et"
  },
  {
    name: "Text with special characters",
    text: "Eesti Teaduste Akadeemia president Tarmo Soomere esines konverentsil.",
    language: "et"
  }
];

async function testNERAPI() {
  console.log('🧪 Testing NER API...\n');
  
  for (const testCase of testTexts) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`Text: "${testCase.text}"`);
    console.log(`Language: ${testCase.language}\n`);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/tools/ner`, {
        text: testCase.text,
        language: testCase.language
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = response.data;
      
      console.log('✅ Response received:');
      console.log(`- Total entities: ${result.summary?.totalEntities || 0}`);
      console.log(`- Entity types: ${JSON.stringify(result.summary?.entityTypes || {})}`);
      console.log(`- Entities with issues: ${result.summary?.entitiesWithIssues || 0}`);
      console.log(`- Processing time: ${result.processing_time?.toFixed(3)}s`);
      
      if (result.entities && result.entities.length > 0) {
        console.log('\n📋 Detected entities:');
        result.entities.forEach((entity, index) => {
          console.log(`  ${index + 1}. "${entity.text}" (${entity.label})`);
          console.log(`     Confidence: ${entity.confidence || 'N/A'}`);
          console.log(`     Issues: ${entity.potentialIssues?.join(', ') || 'None'}`);
          if (entity.suggestions && entity.suggestions.length > 0) {
            console.log(`     Suggestions: ${entity.suggestions.join(', ')}`);
          }
        });
      } else {
        console.log('📋 No entities detected');
      }
      
    } catch (error) {
      console.log('❌ Error:');
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Message: ${error.response.data?.error || error.message}`);
      } else {
        console.log(`  Message: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing health check...\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/tools/ner`, {
      timeout: 5000
    });
    
    console.log('✅ Health check response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Health check failed:');
    console.log(error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting NER API tests...\n');
  
  // Test health check first
  await testHealthCheck();
  console.log('\n');
  
  // Test NER processing
  await testNERAPI();
  
  console.log('✨ Tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testNERAPI, testHealthCheck }; 