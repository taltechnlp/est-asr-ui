import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSimpleASRAgent } from '$lib/agent/simpleAgent';
import { NERTool } from '$lib/agent/nerTool';
import type { TextSegment } from '$lib/components/editor/api/segmentExtraction';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { testType = 'full', customText } = await request.json();
    
    console.log(`Testing segment extraction with NER - Type: ${testType}`);
    
    let result: any = {};
    
    switch (testType) {
      case 'ner-only':
        // Test NER tool directly
        result = await testNERToolOnly(customText);
        break;
      case 'segment-extraction':
        // Test segment extraction from ASR
        result = await testSegmentExtraction();
        break;
      case 'full':
      default:
        // Test full integration
        result = await testFullIntegration();
        break;
    }
    
    return json({
      success: true,
      testType,
      result,
      message: 'Segment extraction with NER test completed successfully'
    });
    
  } catch (error) {
    console.error('Error testing segment extraction with NER:', error);
    return json({
      success: false,
      message: 'Failed to test segment extraction with NER',
      error: error.message
    }, { status: 500 });
  }
};

async function testNERToolOnly(customText?: string): Promise<any> {
  const nerTool = new NERTool();
  const testText = customText || "Tallinna Ülikooli rektor Tiit Land kohtus Tartu Ülikooli professoriga.";
  
  console.log('Testing NER tool with text:', testText);
  
  const nerResult = await nerTool.call(JSON.stringify({
    text: testText,
    language: 'et'
  }));
  
  return {
    inputText: testText,
    nerResult,
    timestamp: new Date().toISOString()
  };
}

async function testSegmentExtraction(): Promise<any> {
  // Get the agent to test segment extraction
  const agent = await getSimpleASRAgent();
  
  // Process mock audio to get ASR output
  const asrResult = await agent.processAudio('/mock/audio/file.mp3');
  
  return {
    asrOutput: {
      transcript: asrResult.transcript,
      segmentCount: asrResult.segmentsOfInterest.length
    },
    segmentsOfInterest: asrResult.segmentsOfInterest.map(segment => ({
      id: segment.id,
      text: segment.text,
      reason: segment.reason,
      uncertaintyScore: segment.uncertaintyScore,
      nerEntities: segment.nerEntities || [],
      action: segment.action,
      priority: segment.priority
    })),
    processingSteps: asrResult.processingSteps,
    timestamp: new Date().toISOString()
  };
}

async function testFullIntegration(): Promise<any> {
  // Test the complete pipeline
  const agent = await getSimpleASRAgent();
  
  // Process mock audio
  const asrResult = await agent.processAudio('/mock/audio/file.mp3');
  
  // Extract segments for detailed analysis
  const segments = createTestSegments(asrResult.transcript);
  
  // Test NER on individual segments
  const nerTool = new NERTool();
  const segmentNERResults = [];
  
  for (const segment of segments) {
    try {
      const nerResult = await nerTool.call(JSON.stringify({
        text: segment.text,
        language: 'et'
      }));
      
      segmentNERResults.push({
        segmentId: segment.id,
        segmentText: segment.text,
        nerResult: nerResult.substring(0, 500) + '...', // Truncate for readability
        hasIssues: nerResult.includes('🔴') || nerResult.includes('🟡')
      });
    } catch (error) {
      segmentNERResults.push({
        segmentId: segment.id,
        segmentText: segment.text,
        error: error.message
      });
    }
  }
  
  return {
    asrOutput: {
      transcript: asrResult.transcript,
      totalSegments: segments.length,
      segmentsWithIssues: segmentNERResults.filter(r => r.hasIssues).length
    },
    segmentAnalysis: {
      segments: segments.map(s => ({
        id: s.id,
        text: s.text,
        wordCount: s.metadata.wordCount,
        confidence: s.metadata.confidence
      })),
      nerResults: segmentNERResults
    },
    segmentsOfInterest: asrResult.segmentsOfInterest.filter(s => s.reason === 'ner_issue').map(segment => ({
      id: segment.id,
      text: segment.text,
      nerEntities: segment.nerEntities || [],
      uncertaintyScore: segment.uncertaintyScore,
      priority: segment.priority,
      categorizationReason: segment.categorizationReason
    })),
    processingSteps: asrResult.processingSteps,
    timestamp: new Date().toISOString()
  };
}

function createTestSegments(transcript: string): TextSegment[] {
  // Create segments from the transcript
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const segments: TextSegment[] = [];
  
  let currentPosition = 0;
  
  sentences.forEach((sentence, index) => {
    if (sentence.trim()) {
      const start = currentPosition;
      const end = currentPosition + sentence.length;
      
      segments.push({
        id: `test_segment_${index}`,
        text: sentence.trim(),
        start,
        end,
        metadata: {
          wordCount: sentence.split(' ').length,
          characterCount: sentence.length,
          hasTimestamps: true,
          marks: [],
          confidence: 0.8 + (Math.random() * 0.2) // Random confidence between 0.8-1.0
        }
      });
      
      currentPosition = end + 1;
    }
  });
  
  return segments;
}

// GET endpoint for testing
export const GET: RequestHandler = async () => {
  try {
    // Quick health check
    const nerTool = new NERTool();
    const testResult = await nerTool.call(JSON.stringify({
      text: "Tallinna Ülikool",
      language: 'et'
    }));
    
    return json({
      success: true,
      message: 'Segment extraction with NER system is working',
      quickTest: {
        input: "Tallinna Ülikool",
        hasResult: testResult.length > 0,
        resultLength: testResult.length
      },
      availableTests: [
        'ner-only',
        'segment-extraction', 
        'full'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return json({
      success: false,
      message: 'Segment extraction with NER system test failed',
      error: error.message
    }, { status: 500 });
  }
}; 