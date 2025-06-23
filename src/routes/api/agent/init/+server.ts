import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSimpleASRAgent } from '$lib/agent/simpleAgent';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { fileId, aiAgentConsent } = await request.json();
    
    if (!aiAgentConsent) {
      return json({ 
        success: false, 
        message: 'AI agent consent required' 
      });
    }

    // Initialize the ASR agent
    const agent = await getSimpleASRAgent();
    
    return json({ 
      success: true, 
      message: 'ASR Agent initialized successfully',
      agentStatus: 'ready'
    });
    
  } catch (error) {
    console.error('Error initializing ASR agent:', error);
    return json({ 
      success: false, 
      message: 'Failed to initialize ASR agent',
      error: error.message 
    }, { status: 500 });
  }
}; 