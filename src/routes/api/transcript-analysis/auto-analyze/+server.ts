import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { prisma } from "$lib/db/client";
import { z } from "zod";
import { extractWordsFromEditor } from "$lib/utils/extractWordsFromEditor";
import { getCoordinatingAgent } from "$lib/agents/coordinatingAgentSimple";
import { getSummaryGenerator } from "$lib/agents/summaryGenerator";
import { extractFullTextWithSpeakers } from "$lib/utils/extractWordsFromEditor";

const AutoAnalyzeSchema = z.object({
  fileId: z.string(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    const session = await locals.auth();
    if (!session?.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const { fileId } = AutoAnalyzeSchema.parse(body);

    console.log(`Starting auto-analysis for file ${fileId}`);

    // Get file and verify ownership
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        uploader: true,
        state: true,
        autoAnalyze: true,
        initialTranscription: true,
        initialTranscriptionPath: true,
        text: true,
        language: true,
        path: true,
      },
    });

    if (!file) {
      return json({ error: "File not found" }, { status: 404 });
    }

    if (file.uploader !== session.user.id) {
      return json({ error: "Access denied" }, { status: 403 });
    }

    if (file.state !== "READY") {
      return json({ error: "File not ready for analysis" }, { status: 400 });
    }

    if (!file.autoAnalyze) {
      return json({ error: "Auto-analysis not requested for this file" }, { status: 400 });
    }

    console.log(`File ${fileId} verified for auto-analysis`);

    // Step 1: Generate Summary (prerequisite for analysis)
    console.log(`Step 1: Generating summary for file ${fileId}`);
    
    try {
      const summaryGenerator = getSummaryGenerator();
      
      // Check if summary already exists
      const existingSummary = await prisma.transcriptSummary.findUnique({
        where: { fileId: file.id }
      });

      let summary;
      if (existingSummary) {
        console.log(`Summary already exists for file ${fileId}`);
        summary = existingSummary;
      } else {
        // Extract full text for summary generation
        let fullText = "";
        if (file.text) {
          const parsedContent = JSON.parse(file.text);
          fullText = extractFullTextWithSpeakers(parsedContent);
        } else if (file.initialTranscription) {
          fullText = file.initialTranscription;
        }

        if (!fullText) {
          throw new Error("No transcript content available for summary generation");
        }

        console.log(`Generating new summary for ${fullText.length} characters of text`);
        
        summary = await summaryGenerator.generateSummary({
          fileId: file.id,
          fullText,
          language: file.language,
          uiLanguage: 'en' // Default to English for auto-analysis
        });

        console.log(`Summary generated successfully for file ${fileId}`);
      }

      // Step 2: Extract first 5 segments
      console.log(`Step 2: Extracting segments for file ${fileId}`);
      
      if (!file.text) {
        throw new Error("No transcript content available for segment extraction");
      }

      const parsedContent = JSON.parse(file.text);
      const extractedWords = extractWordsFromEditor(parsedContent);
      
      // Group words by speaker to create segments
      const segments = [];
      let currentSegment = null;
      
      for (const word of extractedWords) {
        if (!currentSegment || currentSegment.speakerTag !== word.speakerTag) {
          if (currentSegment) {
            segments.push(currentSegment);
          }
          currentSegment = {
            index: segments.length,
            startTime: word.start,
            endTime: word.end,
            startWord: extractedWords.indexOf(word),
            endWord: extractedWords.indexOf(word),
            text: word.text,
            speakerTag: word.speakerTag,
            speakerName: word.speakerTag,
            words: [word]
          };
        } else {
          currentSegment.text += " " + word.text;
          currentSegment.endTime = word.end;
          currentSegment.endWord = extractedWords.indexOf(word);
          currentSegment.words.push(word);
        }
      }
      
      if (currentSegment) {
        segments.push(currentSegment);
      }

      // Take only first 5 segments
      const firstFiveSegments = segments.slice(0, 5);
      console.log(`Extracted ${firstFiveSegments.length} segments for analysis`);

      // Step 3: Launch concurrent analysis for first 5 segments
      console.log(`Step 3: Starting concurrent analysis for ${firstFiveSegments.length} segments`);
      
      const agent = getCoordinatingAgent();
      const analysisPromises = firstFiveSegments.map(async (segment, index) => {
        try {
          console.log(`Starting analysis for segment ${index + 1}/${firstFiveSegments.length}: ${segment.text.substring(0, 100)}...`);
          
          const result = await agent.analyzeSegment({
            fileId: file.id,
            segment,
            summary,
            audioFilePath: file.path,
            uiLanguage: 'en'
          });

          console.log(`Completed analysis for segment ${index + 1}: ${result.suggestions?.length || 0} suggestions`);
          return { segmentIndex: index, success: true, result };
        } catch (error) {
          console.error(`Failed to analyze segment ${index + 1}:`, error);
          return { segmentIndex: index, success: false, error: error.message };
        }
      });

      // Wait for all analyses to complete
      const analysisResults = await Promise.all(analysisPromises);
      
      const successfulAnalyses = analysisResults.filter(r => r.success);
      const failedAnalyses = analysisResults.filter(r => !r.success);

      console.log(`Auto-analysis completed for file ${fileId}:`);
      console.log(`  - Successful: ${successfulAnalyses.length}/${firstFiveSegments.length} segments`);
      console.log(`  - Failed: ${failedAnalyses.length}/${firstFiveSegments.length} segments`);

      if (failedAnalyses.length > 0) {
        console.log("Failed analyses:", failedAnalyses.map(f => f.error));
      }

      return json({
        success: true,
        fileId,
        summaryGenerated: !existingSummary,
        segmentsAnalyzed: successfulAnalyses.length,
        segmentsFailed: failedAnalyses.length,
        results: analysisResults
      });

    } catch (error) {
      console.error(`Auto-analysis failed for file ${fileId}:`, error);
      return json({ 
        error: `Auto-analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Auto-analysis endpoint error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
};