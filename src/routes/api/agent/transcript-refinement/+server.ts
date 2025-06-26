import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { TranscriptRefinementAgent } from '$lib/agent/transcriptRefinementAgent';
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

    console.log(`Starting transcript refinement for file ${fileId}`);
    console.log(`Words: ${words.length}, Speakers: ${speakers.length}`);

    // Run the transcript refinement workflow
    const result = await agent.refineTranscript(
      fileId,
      words,
      speakers,
      transcriptContent
    );

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