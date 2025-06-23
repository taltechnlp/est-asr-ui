import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSimpleASRAgent } from '$lib/agent/simpleAgent';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { audioFilePath } = await request.json();
    
    // Get the agent instance
    const agent = await getSimpleASRAgent();
    
    // Process a mock audio file
    const result = await agent.processAudio(audioFilePath || '/mock/audio/file.mp3');
    
    return json({ 
      success: true, 
      result,
      message: 'Agent test completed successfully'
    });
    
  } catch (error) {
    console.error('Error testing ASR agent:', error);
    return json({ 
      success: false, 
      message: 'Failed to test ASR agent',
      error: error.message 
    }, { status: 500 });
  }
}; 