import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSimpleASRAgent } from '$lib/agent/simpleAgent';
import { isOpenRouterAvailable } from '$lib/agent/config';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { testType = 'full' } = await request.json();
    
    // Check OpenRouter availability
    const openRouterAvailable = isOpenRouterAvailable();
    
    if (testType === 'status') {
      return json({ 
        success: true, 
        openRouterAvailable,
        message: openRouterAvailable ? 'OpenRouter is available' : 'OpenRouter not available - using fallbacks'
      });
    }
    
    // Get the agent instance
    const agent = await getSimpleASRAgent();
    
    // Process a mock audio file
    const result = await agent.processAudio('/mock/audio/file.mp3');
    
    return json({ 
      success: true, 
      openRouterAvailable,
      result,
      message: 'Agent test completed successfully'
    });
    
  } catch (error) {
    console.error('Error testing OpenRouter integration:', error);
    return json({ 
      success: false, 
      message: 'Failed to test OpenRouter integration',
      error: error.message 
    }, { status: 500 });
  }
}; 