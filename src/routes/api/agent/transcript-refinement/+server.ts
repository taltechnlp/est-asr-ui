import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { TranscriptRefinementAgent } from '$lib/agent/transcriptRefinementAgent';
import { getSimpleASRAgent } from '$lib/agent/simpleAgent';
import { processAudioWithLangGraph } from '$lib/agent/langGraphAgent';
import { prisma } from '$lib/db/client';
import { promises as fs } from 'fs';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const session = await locals.auth();
    if (!session || !session.user.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get file from database
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        User: {
          select: { id: true, email: true }
        }
      }
    });

    if (!file) {
      return json({ error: 'File not found' }, { status: 404 });
    }

    // Check authorization
    if (file.User.id !== session.user.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read file content
    const content = await fs.readFile(file.initialTranscriptionPath, 'utf8');
    const fileContent = JSON.parse(content);

    // Initialize the transcript refinement agent
    const agent = new TranscriptRefinementAgent();

    // Extract words and speakers from the content
    let words: any[] = [];
    let speakers: any[] = [];
    let transcriptContent: any;

    // Parse content based on format
    if (fileContent && !fileContent.type) {
      // Estonian format - convert to editor format
      const { fromEstFormat } = await import('$lib/helpers/converters/estFormat');
      const converted = fromEstFormat(fileContent);
      words = converted.words;
      speakers = converted.speakers;
      transcriptContent = converted.transcription;
    } else if (fileContent && fileContent.content) {
      // Already in Editor format
      fileContent.content.forEach((node: any) => {
        const start = node.content?.[0]?.marks?.[0]?.attrs?.start || -1;
        const end = node.content?.[node.content.length - 1]?.marks?.[0]?.attrs?.end || -1;
        speakers.push({ name: node.attrs['data-name'], id: node.attrs.id, start, end });
        
        if (node.content) {
          node.content.forEach((inlineNode: any) => {
            if (inlineNode.type === 'text' && inlineNode.marks?.length > 0) {
              inlineNode.marks.forEach((mark: any) => {
                if (mark.type === 'word') {
                  words.push({ start: mark.attrs.start, end: mark.attrs.end, id: mark.attrs.id });
                }
              });
            }
          });
        }
      });
      transcriptContent = fileContent;
    } else {
      transcriptContent = fileContent;
    }

    console.log(`🚀 Starting LangGraph ASR Agent with Web Search for file ${fileId}`);
    console.log(`📊 Parsed content: Words: ${words.length}, Speakers: ${speakers.length}`);

    // Create a mock transcript from the content for the agent
    let transcript = '';
    if (transcriptContent && transcriptContent.content) {
      // Extract text from editor format
      transcript = transcriptContent.content.map((node: any) => {
        if (node.content) {
          return node.content.map((inlineNode: any) => {
            if (inlineNode.type === 'text') {
              return inlineNode.text || '';
            }
            return '';
          }).join('');
        }
        return '';
      }).join(' ');
    }

    console.log(`📝 Extracted transcript for analysis: "${transcript.substring(0, 200)}..." (${transcript.length} chars)`);

    // Prepare word data for the agent
    const wordData = words.map((word, index) => ({
      start: word.start || index,
      end: word.end || index + 1,
      id: word.id || `word_${index}`,
      text: `word_${index}` // We don't have the actual word text in the current format
    }));

    // Run the new LangGraph agent with REAL content
    console.log(`🔗 Running LangGraph ASR Agent with REAL transcript content (${transcript.length} chars)...`);
    const agentResult = await processAudioWithLangGraph(
      `real_content_${fileId}.wav`, 
      'et', 
      transcript, // Pass the real transcript
      wordData, // Pass real word timings
      speakers // Pass real speaker data
    );
    const processingTime = agentResult.processingTime;

    console.log(`✅ LangGraph ASR Agent completed in ${processingTime}ms`);
    console.log(`📊 Agent Results:`);
    console.log(`   - Transcript analyzed: ${agentResult.transcript.length} chars`);
    console.log(`   - Segments of Interest: ${agentResult.segmentsOfInterest.length}`);
    console.log(`   - Processing Steps: ${agentResult.processingSteps.length}`);
    if (agentResult.webSearchContext) {
      console.log(`   - Web Search Context: ${agentResult.webSearchContext.substring(0, 300)}...`);
    }

    // Convert agent results to the expected format for the UI
    const result = {
      totalSegments: agentResult.segmentsOfInterest.length,
      segmentsWithIssues: agentResult.segmentsOfInterest.filter(s => s.uncertaintyScore > 0.5).length,
      processingTime,
      webSearchContext: agentResult.webSearchContext,
      processingSteps: agentResult.processingSteps,
      segments: agentResult.segmentsOfInterest.map(segment => ({
        id: segment.id,
        text: segment.text,
        speaker: 'System', // Mock speaker since we don't have real ASR output
        reason: segment.reason,
        uncertaintyScore: segment.uncertaintyScore,
        action: segment.action,
        priority: segment.priority,
        categorizationReason: segment.categorizationReason,
        webSearchResults: segment.webSearchResults,
        corrections: segment.webSearchResults ? [{
          original: segment.text,
          suggested: segment.webSearchResults.verified ? 
            `${segment.text} (✅ Verified)` : 
            `${segment.text} (❌ Unverified - needs review)`,
          reasoning: segment.categorizationReason || 'Web search analysis',
          confidence: segment.webSearchResults.confidence || 0.5
        }] : []
      })),
      summary: {
        totalCorrections: agentResult.segmentsOfInterest.filter(s => 
          s.webSearchResults && (!s.webSearchResults.verified || s.uncertaintyScore > 0.5)
        ).length,
        webSearchQueries: agentResult.segmentsOfInterest
          .filter(s => s.webSearchResults)
          .map(s => s.webSearchResults!.query),
        verifiedEntities: agentResult.segmentsOfInterest
          .filter(s => s.webSearchResults?.verified)
          .map(s => s.text),
        unverifiedEntities: agentResult.segmentsOfInterest
          .filter(s => s.webSearchResults && !s.webSearchResults.verified)
          .map(s => s.text)
      }
    };

    console.log(`📋 Final result summary:`);
    console.log(`   - Total segments: ${result.totalSegments}`);
    console.log(`   - Segments with issues: ${result.segmentsWithIssues}`);
    console.log(`   - Total corrections: ${result.summary.totalCorrections}`);
    console.log(`   - Web search queries: ${result.summary.webSearchQueries.join(', ')}`);
    console.log(`   - Verified entities: ${result.summary.verifiedEntities.join(', ')}`);
    console.log(`   - Unverified entities: ${result.summary.unverifiedEntities.join(', ')}`);

    // Also run the original agent for comparison (optional)
    // const agent = new TranscriptRefinementAgent();
    // const originalResult = await agent.refineTranscript(fileId, words, speakers, transcriptContent);

    // Store the refinement result in the database (optional)
    // You could create a new table to store refinement results
    // await prisma.transcriptRefinement.create({
    //   data: {
    //     fileId,
    //     result: JSON.stringify(result),
    //     userId: session.user.id
    //   }
    // });

    return json({
      success: true,
      result,
      message: 'Transcript refinement completed successfully'
    });

  } catch (error) {
    console.error('Error in transcript refinement API:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to process transcript refinement'
    }, { status: 500 });
  }
};

// GET endpoint for checking refinement status
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const session = await locals.auth();
    if (!session || !session.user.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return json({ error: 'File ID is required' }, { status: 400 });
    }

    // Check if file exists and user has access
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        User: {
          select: { id: true }
        }
      }
    });

    if (!file) {
      return json({ error: 'File not found' }, { status: 404 });
    }

    if (file.User.id !== session.user.id) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return a simple status
    // In a real implementation, you might store refinement results in the database
    return json({
      status: 'ready',
      message: 'Transcript refinement system is ready',
      fileId
    });

  } catch (error) {
    console.error('Error checking refinement status:', error);
    
    return json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}; 