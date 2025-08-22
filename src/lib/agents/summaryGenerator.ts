import { createOpenRouterChat, OPENROUTER_MODELS } from "$lib/llm/openrouter-direct";
import { HumanMessage } from "@langchain/core/messages";
import { prisma } from "$lib/db/client";
import type { TranscriptSummary } from "@prisma/client";
import { getLanguageName, normalizeLanguageCode, type SupportedLanguage } from "$lib/utils/language";
import { robustJsonParse, formatParsingErrorForLLM, validateJsonStructure } from "./utils/jsonParser";

export interface SummaryGenerationOptions {
  forceRegenerate?: boolean;
  modelName?: string;
  uiLanguage?: string;
}

export interface SummaryResult {
  summary: string;
  keyTopics: string[];
  speakerCount: number;
  language: string;
}

const SUMMARY_PROMPT = `You are an expert transcript analyst. Analyze the following transcript and provide:

1. A comprehensive summary (2-3 paragraphs) that captures:
   - Main topics discussed
   - Key decisions or conclusions
   - Important action items or next steps
   - Overall tone and context

2. Extract 5-10 key topics/themes as short phrases

3. Count the number of unique speakers

4. Identify the primary language (et/fi/en)

Transcript:
{transcript}

IMPORTANT: Provide your summary in English for consistency.

Respond in JSON format:
{
  "summary": "comprehensive summary here...",
  "keyTopics": ["topic1", "topic2", ...],
  "speakerCount": number,
  "language": "et|fi|en"
}`;

const DISPLAY_SUMMARY_PROMPT = `You are an expert transcript analyst. Create a user-friendly summary of the following transcript.

Provide a comprehensive summary (2-3 paragraphs) that captures:
- Main topics discussed
- Key decisions or conclusions
- Important action items or next steps
- Overall tone and context

Transcript:
{transcript}

IMPORTANT: Provide your summary in {language} language.

Respond with just the summary text, no JSON formatting needed.`;

const TRANSLATE_KEY_TOPICS_PROMPT = `Translate the following key topics/themes to {language} language. Keep them as short phrases.

Topics to translate:
{topics}

IMPORTANT: Respond in {language} language with a JSON array of translated topics.

Example response format:
["translated topic 1", "translated topic 2", ...]`;

export class SummaryGenerator {
  private model;

  constructor(modelName: string = OPENROUTER_MODELS.GPT_4O) {
    this.model = createOpenRouterChat({
      modelName,
      temperature: 0.3, // Lower temperature for consistent summaries
      maxTokens: 2000,
    });
  }


  async generateSummary(
    fileId: string,
    transcript: string,
    options: SummaryGenerationOptions = {}
  ): Promise<TranscriptSummary> {
    const uiLanguage = normalizeLanguageCode(options.uiLanguage);
    
    // Check if summary already exists and matches the requested UI language
    if (!options.forceRegenerate) {
      const existingSummary = await prisma.transcriptSummary.findUnique({
        where: { fileId },
      });

      if (existingSummary) {
        // If we need a different UI language or don't have a display summary yet
        if (existingSummary.uiLanguage !== uiLanguage || !existingSummary.displaySummary) {
          // Generate display summary in the requested language if needed
          if (uiLanguage !== 'en') {
            const displaySummary = await this.generateDisplaySummary(transcript, uiLanguage);
            const displayKeyTopics = await this.translateKeyTopics(existingSummary.keyTopics, uiLanguage);
            const updated = await prisma.transcriptSummary.update({
              where: { fileId },
              data: {
                displaySummary,
                displayKeyTopics,
                uiLanguage,
              },
            });
            return updated;
          }
        }
        return existingSummary;
      }
    }

    try {
      // Generate main summary in English
      const prompt = SUMMARY_PROMPT.replace("{transcript}", transcript);
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      // Parse the JSON response with robust parsing
      const content = response.content as string;
      let parseResult = robustJsonParse(content);
      
      // If parsing failed, try to get corrected response from LLM
      if (!parseResult.success) {
        console.warn('Initial JSON parsing failed, attempting correction...');
        
        const correctionPrompt = `${formatParsingErrorForLLM(
          parseResult.error || 'Unknown error',
          content
        )}

Please provide the corrected JSON response with proper formatting.`;

        try {
          const correctionResponse = await this.model.invoke([
            new HumanMessage({ content: correctionPrompt }),
          ]);
          
          const correctedContent = correctionResponse.content as string;
          parseResult = robustJsonParse(correctedContent);
          
          if (!parseResult.success) {
            throw new Error(`Failed to parse summary JSON even after correction: ${parseResult.error}`);
          }
        } catch (correctionError) {
          throw new Error(`Failed to parse summary JSON: ${parseResult.error}`);
        }
      }
      
      let result = parseResult.data as SummaryResult;
      
      // Step 1: Detect and recover format if needed
      const formatRecoveryResult = await this.detectAndRecoverFormat(result, transcript);
      if (formatRecoveryResult.recovered) {
        result = formatRecoveryResult.data;
        console.log('✅ Format recovery successful');
      }
      
      // Step 2: Validate the structure and attempt field recovery if needed
      const requiredFields = ['summary', 'keyTopics', 'speakerCount', 'language'];
      const missingFields = requiredFields.filter(field => !(field in result));
      
      if (missingFields.length > 0) {
        console.warn('Summary validation failed, attempting field recovery...');
        console.warn('Required fields:', requiredFields);
        console.warn('Actual fields:', Object.keys(result));
        console.warn('Missing fields:', missingFields);
        console.warn('Result sample:', JSON.stringify(result).substring(0, 500));
        
        // Attempt field-specific recovery
        const fieldRecoveryResult = await this.recoverMissingFields(result, missingFields, transcript);
        if (fieldRecoveryResult.recovered) {
          result = fieldRecoveryResult.data;
          console.log('✅ Field recovery successful');
        } else {
          // Final fallback: create a valid summary from available data
          console.warn('Field recovery failed, creating fallback summary...');
          result = this.createFallbackSummary(result, transcript);
          console.log('✅ Fallback summary created');
        }
      }

      // Generate display summary and translate key topics in UI language if different from English
      let displaySummary: string | null = null;
      let displayKeyTopics: string[] = result.keyTopics;
      
      if (uiLanguage !== 'en') {
        displaySummary = await this.generateDisplaySummary(transcript, uiLanguage);
        displayKeyTopics = await this.translateKeyTopics(result.keyTopics, uiLanguage);
      }

      // Store in database
      const summary = await prisma.transcriptSummary.upsert({
        where: { fileId },
        create: {
          fileId,
          summary: result.summary,
          displaySummary,
          uiLanguage: uiLanguage !== 'en' ? uiLanguage : null,
          keyTopics: result.keyTopics,
          displayKeyTopics,
          speakerCount: result.speakerCount,
          language: result.language,
        },
        update: {
          summary: result.summary,
          displaySummary,
          uiLanguage: uiLanguage !== 'en' ? uiLanguage : null,
          keyTopics: result.keyTopics,
          displayKeyTopics,
          speakerCount: result.speakerCount,
          language: result.language,
        },
      });

      return summary;
    } catch (error) {
      console.error("Summary generation error:", error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async generateDisplaySummary(transcript: string, uiLanguage: SupportedLanguage): Promise<string> {
    try {
      const languageName = getLanguageName(uiLanguage);
      const prompt = DISPLAY_SUMMARY_PROMPT
        .replace("{transcript}", transcript)
        .replace("{language}", languageName);
      
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      return response.content as string;
    } catch (error) {
      console.error("Display summary generation error:", error);
      throw new Error(`Failed to generate display summary: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async translateKeyTopics(topics: string[], uiLanguage: SupportedLanguage): Promise<string[]> {
    try {
      const languageName = getLanguageName(uiLanguage);
      const prompt = TRANSLATE_KEY_TOPICS_PROMPT
        .replace("{topics}", topics.join("\n"))
        .replace(/{language}/g, languageName);
      
      const response = await this.model.invoke([
        new HumanMessage({ content: prompt }),
      ]);

      const content = response.content as string;
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("Failed to parse translated topics response:", content);
        return topics; // Return original topics as fallback
      }

      const parseResult = robustJsonParse(jsonMatch[0]);
      if (!parseResult.success) {
        console.error("Failed to parse translated topics:", parseResult.error);
        return topics; // Return original topics as fallback
      }
      return parseResult.data;
    } catch (error) {
      console.error("Key topics translation error:", error);
      return topics; // Return original topics as fallback
    }
  }

  async getSummary(fileId: string): Promise<TranscriptSummary | null> {
    return prisma.transcriptSummary.findUnique({
      where: { fileId },
    });
  }

  async deleteSummary(fileId: string): Promise<void> {
    await prisma.transcriptSummary.delete({
      where: { fileId },
    }).catch(() => {
      // Ignore if summary doesn't exist
    });
  }

  /**
   * Detect and recover from format issues (e.g., array instead of object)
   */
  private async detectAndRecoverFormat(
    result: any, 
    transcript: string
  ): Promise<{ recovered: boolean; data: any }> {
    // Check if result is an array (common LLM mistake)
    if (Array.isArray(result)) {
      console.log('🔄 Detected array response, attempting format recovery...');
      
      // Assume the array contains keyTopics
      const keyTopics = result;
      
      // Create a recovery prompt to get the full structure
      const formatRecoveryPrompt = `You provided only an array of key topics, but I need a complete JSON object.

Key topics you provided: ${JSON.stringify(keyTopics)}

Transcript to analyze:
${transcript.substring(0, 1000)}${transcript.length > 1000 ? '...' : ''}

Please provide the COMPLETE analysis in the exact JSON format:
{
  "summary": "comprehensive summary (2-3 paragraphs) of the transcript",
  "keyTopics": ${JSON.stringify(keyTopics)},
  "speakerCount": number_of_unique_speakers,
  "language": "et|fi|en"
}

CRITICAL: Return ONLY the complete JSON object. No explanations or other text.`;

      try {
        const recoveryResponse = await this.model.invoke([
          new HumanMessage({ content: formatRecoveryPrompt }),
        ]);
        
        const recoveryContent = recoveryResponse.content as string;
        const recoveryParseResult = robustJsonParse(recoveryContent);
        
        if (recoveryParseResult.success && typeof recoveryParseResult.data === 'object' && !Array.isArray(recoveryParseResult.data)) {
          console.log('✅ Format recovery successful');
          return { recovered: true, data: recoveryParseResult.data };
        } else {
          console.warn('Format recovery failed, parsed data is still not an object');
        }
      } catch (error) {
        console.error('Format recovery error:', error);
      }
    }
    
    // Check if result is a string (another common mistake)
    if (typeof result === 'string') {
      console.log('🔄 Detected string response, attempting format recovery...');
      
      const stringRecoveryPrompt = `You provided only a string response, but I need a complete JSON object.

Your response: "${result}"

Transcript to analyze:
${transcript.substring(0, 1000)}${transcript.length > 1000 ? '...' : ''}

Please provide the COMPLETE analysis in the exact JSON format:
{
  "summary": "comprehensive summary (use your previous response as basis if it was a summary)",
  "keyTopics": ["extract", "5-10", "key", "topics", "from", "transcript"],
  "speakerCount": number_of_unique_speakers,
  "language": "et|fi|en"
}

CRITICAL: Return ONLY the complete JSON object. No explanations or other text.`;

      try {
        const recoveryResponse = await this.model.invoke([
          new HumanMessage({ content: stringRecoveryPrompt }),
        ]);
        
        const recoveryContent = recoveryResponse.content as string;
        const recoveryParseResult = robustJsonParse(recoveryContent);
        
        if (recoveryParseResult.success && typeof recoveryParseResult.data === 'object' && !Array.isArray(recoveryParseResult.data)) {
          return { recovered: true, data: recoveryParseResult.data };
        }
      } catch (error) {
        console.error('String format recovery error:', error);
      }
    }
    
    return { recovered: false, data: result };
  }

  /**
   * Recover missing fields by prompting LLM for specific missing data
   */
  private async recoverMissingFields(
    result: any, 
    missingFields: string[], 
    transcript: string
  ): Promise<{ recovered: boolean; data: any }> {
    console.log(`🔄 Attempting to recover missing fields: ${missingFields.join(', ')}`);
    
    // Build a targeted prompt for the missing fields
    const availableData = Object.keys(result).length > 0 ? 
      `\n\nData you already provided:\n${JSON.stringify(result, null, 2)}` : '';
    
    const fieldDescriptions = {
      summary: 'A comprehensive 2-3 paragraph summary of the transcript',
      keyTopics: 'An array of 5-10 key topics/themes as short phrases',
      speakerCount: 'The number of unique speakers in the transcript',
      language: 'The primary language (et|fi|en)'
    };
    
    const missingFieldPrompts = missingFields.map(field => 
      `- ${field}: ${fieldDescriptions[field] || 'Required field'}`
    ).join('\n');
    
    const fieldRecoveryPrompt = `I need you to complete the missing fields from your previous response.
${availableData}

Transcript to analyze:
${transcript.substring(0, 1500)}${transcript.length > 1500 ? '...' : ''}

Missing fields that need to be provided:
${missingFieldPrompts}

Please provide the COMPLETE JSON object with ALL required fields:
{
  "summary": "comprehensive summary here...",
  "keyTopics": ["topic1", "topic2", "topic3", ...],
  "speakerCount": number,
  "language": "et|fi|en"
}

Use any data from your previous response if applicable.
CRITICAL: Return ONLY the complete JSON object. No explanations or other text.`;

    try {
      const recoveryResponse = await this.model.invoke([
        new HumanMessage({ content: fieldRecoveryPrompt }),
      ]);
      
      const recoveryContent = recoveryResponse.content as string;
      const recoveryParseResult = robustJsonParse(recoveryContent);
      
      if (recoveryParseResult.success) {
        const recoveredData = recoveryParseResult.data;
        
        // Validate that the missing fields are now present
        const stillMissing = missingFields.filter(field => !(field in recoveredData));
        
        if (stillMissing.length === 0) {
          console.log('✅ All missing fields successfully recovered');
          return { recovered: true, data: recoveredData };
        } else {
          console.warn(`⚠️ Some fields still missing after recovery: ${stillMissing.join(', ')}`);
          // Return partial recovery - let fallback handle the rest
          return { recovered: false, data: recoveredData };
        }
      } else {
        console.error('Field recovery parsing failed:', recoveryParseResult.error);
      }
    } catch (error) {
      console.error('Field recovery error:', error);
    }
    
    return { recovered: false, data: result };
  }

  /**
   * Create a fallback summary when all recovery attempts fail
   */
  private createFallbackSummary(result: any, transcript: string): SummaryResult {
    console.log('🛡️ Creating fallback summary from available data...');
    
    // Extract what we can from the result
    let summary = '';
    let keyTopics: string[] = [];
    let speakerCount = 1;
    let language = 'et'; // Default to Estonian
    
    // Try to extract data from whatever format we received
    if (Array.isArray(result)) {
      // Assume it's keyTopics
      keyTopics = result.filter(item => typeof item === 'string').slice(0, 10);
      summary = `Transcript analysis identified ${keyTopics.length} key topics: ${keyTopics.slice(0, 3).join(', ')}${keyTopics.length > 3 ? ', and others' : ''}.`;
    } else if (typeof result === 'string') {
      // Assume it's a summary
      summary = result;
      // Extract simple topics from the summary
      keyTopics = this.extractTopicsFromText(result);
    } else if (typeof result === 'object') {
      // Try to extract partial data
      summary = result.summary || result.text || result.description || 'Transcript analysis completed.';
      keyTopics = result.keyTopics || result.topics || result.themes || [];
      speakerCount = result.speakerCount || result.speakers || 1;
      language = result.language || 'et';
    }
    
    // Ensure keyTopics is an array
    if (!Array.isArray(keyTopics)) {
      keyTopics = typeof keyTopics === 'string' ? [keyTopics] : [];
    }
    
    // Fallback summary generation if we don't have one
    if (!summary || summary.length < 20) {
      summary = `This transcript contains ${transcript.length} characters of content with ${speakerCount} speaker(s). ` +
        `Key topics discussed include: ${keyTopics.slice(0, 5).join(', ') || 'various subjects'}. ` +
        `The conversation appears to be in ${language === 'et' ? 'Estonian' : language === 'fi' ? 'Finnish' : 'English'}.`;
    }
    
    // Ensure minimum topics
    if (keyTopics.length === 0) {
      keyTopics = this.extractTopicsFromText(transcript);
    }
    
    // Estimate speaker count from transcript if not provided
    if (speakerCount <= 0) {
      speakerCount = this.estimateSpeakerCount(transcript);
    }
    
    console.log(`📋 Fallback summary created: ${summary.length} chars, ${keyTopics.length} topics, ${speakerCount} speakers`);
    
    return {
      summary,
      keyTopics: keyTopics.slice(0, 10), // Limit to 10 topics
      speakerCount: Math.max(1, speakerCount),
      language
    };
  }

  /**
   * Extract topics from text using simple heuristics
   */
  private extractTopicsFromText(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'a', 'an', 'ja', 'või', 'aga', 'ning', 'kui', 'et', 'see', 'tema', 'ta']);
    
    // Find longer, potentially meaningful words
    const candidateTopics = words
      .filter(word => word.length >= 4 && !commonWords.has(word))
      .slice(0, 8);
    
    return candidateTopics.length > 0 ? candidateTopics : ['general discussion'];
  }

  /**
   * Estimate speaker count from transcript
   */
  private estimateSpeakerCount(transcript: string): number {
    // Look for speaker indicators
    const speakerPatterns = [
      /speaker\s*\d+/gi,
      /\b[A-Z][a-z]+:/g, // Name: pattern
      /^[A-Z][a-z]+\s*$/gm, // Lines with just names
    ];
    
    const speakerIndicators = new Set();
    speakerPatterns.forEach(pattern => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach(match => speakerIndicators.add(match.toLowerCase()));
      }
    });
    
    return Math.max(1, Math.min(speakerIndicators.size || 1, 6)); // Cap at reasonable number
  }
}

// Singleton instance
let summaryGeneratorInstance: SummaryGenerator | null = null;

export function getSummaryGenerator(modelName?: string): SummaryGenerator {
  if (!summaryGeneratorInstance || modelName) {
    summaryGeneratorInstance = new SummaryGenerator(modelName);
  }
  return summaryGeneratorInstance;
}