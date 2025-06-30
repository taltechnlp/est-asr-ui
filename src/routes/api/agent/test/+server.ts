import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSimpleASRAgent } from '$lib/agent/simpleAgent';
import { processAudioWithLangGraph } from '$lib/agent/langGraphAgent';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { audioFilePath, testRealContent } = await request.json();
    
    if (testRealContent) {
      // Test with REAL content (simulating TipTap editor content) - including "Mina" to test filtering
      const realTranscript = "Tere! Mina olen Tallinna Ülikooli rektor professor Tiit Land. Mina ja tema kohtusime Tartu Ülikooli kolleegidega. Arutasime koostööd tehisintellekti ja keeletehnoloogia valdkonnas. Estonian Academy of Sciences toetab meie algatust.";
      
      const realWords = [
        { start: 0, end: 1, id: "word_1", text: "Tere!" },
        { start: 1, end: 2.5, id: "word_2", text: "Ma" },
        { start: 2.5, end: 3, id: "word_3", text: "olen" },
        { start: 3, end: 4.5, id: "word_4", text: "Tallinna" },
        { start: 4.5, end: 6, id: "word_5", text: "Ülikooli" }
      ];
      
      const realSpeakers = [
        { name: "Professor Tiit Land", id: "speaker_1", start: 0, end: 50 }
      ];
      
      console.log(`🎯 Testing LangGraph Agent with REAL content: "${realTranscript.substring(0, 100)}..."`);
      
      // Test LangGraph agent with real content
      const langGraphResult = await processAudioWithLangGraph(
        audioFilePath || '/real/content/test.mp3',
        'et',
        realTranscript,
        realWords,
        realSpeakers
      );
      
      return json({ 
        success: true, 
        result: langGraphResult,
        contentType: 'REAL_CONTENT',
        transcript: realTranscript,
        message: 'LangGraph agent test with REAL content completed successfully'
      });
    } else {
      // Test with SimpleASRAgent (mock content)
      console.log(`🔄 Testing SimpleASRAgent with mock content...`);
      const agent = await getSimpleASRAgent();
      const result = await agent.processAudio(audioFilePath || '/mock/audio/file.mp3');
      
      return json({ 
        success: true, 
        result,
        contentType: 'MOCK_CONTENT',
        message: 'SimpleASRAgent test with mock content completed successfully'
      });
    }
    
  } catch (error) {
    console.error('Error testing ASR agent:', error);
    return json({ 
      success: false, 
      message: 'Failed to test ASR agent',
      error: error.message 
    }, { status: 500 });
  }
}; 