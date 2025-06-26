import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import axios from 'axios';

// Types for NER response
interface NEREntity {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence?: number;
}

interface NERResponse {
  entities: NEREntity[];
  text: string;
  language?: string;
  processing_time?: number;
  summary?: {
    totalEntities: number;
    entityTypes: Record<string, number>;
    entitiesWithIssues: number;
    highConfidenceEntities: number;
    lowConfidenceEntities: number;
    averageEntityLength: number;
  };
  fallback?: boolean;
}

interface NERRequest {
  text: string;
  language?: string;
}

// Configuration for different environments
const NER_CONFIG = {
  development: {
    url: 'https://api.tartunlp.ai/bert/ner/v1',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  production: {
    url: process.env.NER_SERVICE_URL || 'http://localhost:8000/ner',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  }
};

// Helper function to detect potential misspellings or misrecognitions
function analyzeEntityPotentialIssues(entity: NEREntity, text: string): {
  potentialIssues: string[];
  suggestions: string[];
  confidence: 'high' | 'medium' | 'low';
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // Check for unusual capitalization patterns
  const words = entity.text.split(' ');
  const hasMixedCase = words.some(word => 
    word.length > 1 && 
    word[0] === word[0].toLowerCase() && 
    word.slice(1).includes(word.slice(1).toUpperCase())
  );
  
  if (hasMixedCase) {
    issues.push('mixed_case');
    suggestions.push('Check capitalization pattern');
  }

  // Check for repeated characters (common ASR error)
  const hasRepeatedChars = /(.)\1{2,}/.test(entity.text);
  if (hasRepeatedChars) {
    issues.push('repeated_characters');
    suggestions.push('Check for repeated characters');
  }

  // Check for unusual character combinations
  const unusualPatterns = /[aeiou]{4,}|[bcdfghjklmnpqrstvwxyz]{5,}/i;
  if (unusualPatterns.test(entity.text)) {
    issues.push('unusual_character_pattern');
    suggestions.push('Check character sequence');
  }

  // Check if entity appears to be at sentence boundaries but might be misplaced
  const contextBefore = text.substring(Math.max(0, entity.start - 50), entity.start);
  const contextAfter = text.substring(entity.end, Math.min(text.length, entity.end + 50));
  
  const sentenceEndBefore = /[.!?]\s*$/.test(contextBefore);
  const sentenceStartAfter = /^\s*[A-Z]/.test(contextAfter);
  
  if (sentenceEndBefore && sentenceStartAfter) {
    issues.push('potential_boundary_issue');
    suggestions.push('Check if entity spans sentence boundaries');
  }

  // Adjust confidence based on number of issues
  if (issues.length === 0) {
    confidence = 'high';
  } else if (issues.length >= 3) {
    confidence = 'low';
  }

  return { potentialIssues: issues, suggestions, confidence };
}

// Helper function to get entity context
function getEntityContext(entity: NEREntity, text: string, contextSize: number = 100): {
  before: string;
  after: string;
  fullContext: string;
} {
  const start = Math.max(0, entity.start - contextSize);
  const end = Math.min(text.length, entity.end + contextSize);
  
  return {
    before: text.substring(start, entity.start),
    after: text.substring(entity.end, end),
    fullContext: text.substring(start, end)
  };
}

// Helper function to parse TartuNLP API response format
function parseTartuNLPResponse(result: any[], originalText: string): NEREntity[] {
  const entities: NEREntity[] = [];
  
  // TartuNLP returns result as array of sentences, each sentence is array of tokens
  for (const sentence of result) {
    if (!Array.isArray(sentence)) continue;
    
    let currentEntity: { text: string; label: string; start: number; end: number } | null = null;
    
    for (let i = 0; i < sentence.length; i++) {
      const token = sentence[i];
      const { word, ner } = token;
      
      // Find the position of this word in the original text
      const wordStart = originalText.indexOf(word, currentEntity ? currentEntity.end : 0);
      const wordEnd = wordStart + word.length;
      
      if (ner.startsWith('B-')) {
        // Beginning of entity
        if (currentEntity) {
          // Save previous entity
          entities.push({
            text: currentEntity.text,
            label: currentEntity.label,
            start: currentEntity.start,
            end: currentEntity.end
          });
        }
        
        // Start new entity
        currentEntity = {
          text: word,
          label: ner.substring(2), // Remove 'B-' prefix
          start: wordStart,
          end: wordEnd
        };
      } else if (ner.startsWith('I-') && currentEntity && ner.substring(2) === currentEntity.label) {
        // Inside of entity (same type)
        currentEntity.text += ' ' + word;
        currentEntity.end = wordEnd;
      } else if (ner === 'O') {
        // Outside entity
        if (currentEntity) {
          // Save current entity
          entities.push({
            text: currentEntity.text,
            label: currentEntity.label,
            start: currentEntity.start,
            end: currentEntity.end
          });
          currentEntity = null;
        }
      }
    }
    
    // Don't forget the last entity in the sentence
    if (currentEntity) {
      entities.push({
        text: currentEntity.text,
        label: currentEntity.label,
        start: currentEntity.start,
        end: currentEntity.end
      });
    }
  }
  
  return entities;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: NERRequest = await request.json();
    const { text, language = 'et' } = body;

    if (!text || typeof text !== 'string') {
      return json(
        { error: 'Invalid request: text is required and must be a string' },
        { status: 400 }
      );
    }

    // Determine environment and configuration
    const isDev = process.env.NODE_ENV === 'development';
    const config = isDev ? NER_CONFIG.development : NER_CONFIG.production;

    console.log(`NER request for ${text.length} characters, language: ${language}, environment: ${isDev ? 'development' : 'production'}`);

    // Try to make request to NER service
    let response;
    let useFallback = false;
    
    try {
      response = await axios.post(config.url, {
        text,
        language
      }, {
        timeout: config.timeout,
        headers: config.headers
      });
    } catch (serviceError) {
      console.warn('NER service unavailable, using fallback:', serviceError.message);
      useFallback = true;
    }

    let rawEntities;
    
    if (useFallback) {
      const fallbackEntities = generateFallbackNERResults(text);
      // Enrich fallback entities as in the normal flow
      const enrichedEntities = fallbackEntities.map((entity: any) => {
        const analysis = analyzeEntityPotentialIssues(entity, text);
        const context = getEntityContext(entity, text);
        return {
          ...entity,
          potentialIssues: analysis.potentialIssues,
          suggestions: analysis.suggestions,
          confidence: analysis.confidence,
          context,
          metadata: {
            entityType: entity.label,
            length: entity.text.length,
            wordCount: entity.text.split(' ').length,
            hasSpecialChars: /[^a-zA-ZäöüõšžÄÖÜÕŠŽ\s]/.test(entity.text),
            isAllCaps: entity.text === entity.text.toUpperCase() && entity.text.length > 1,
            isAllLower: entity.text === entity.text.toLowerCase() && entity.text.length > 1
          }
        };
      });
      const summary = {
        totalEntities: enrichedEntities.length,
        entityTypes: enrichedEntities.reduce((acc: Record<string, number>, entity) => {
          acc[entity.label] = (acc[entity.label] || 0) + 1;
          return acc;
        }, {}),
        entitiesWithIssues: enrichedEntities.filter(e => e.potentialIssues.length > 0).length,
        highConfidenceEntities: enrichedEntities.filter(e => e.confidence === 'high').length,
        lowConfidenceEntities: enrichedEntities.filter(e => e.confidence === 'low').length,
        averageEntityLength: enrichedEntities.length > 0 
          ? enrichedEntities.reduce((sum, e) => sum + e.text.length, 0) / enrichedEntities.length 
          : 0
      };
      const result: NERResponse = {
        entities: enrichedEntities,
        text,
        language,
        processing_time: Date.now(),
        summary,
        fallback: true
      };
      return json(result);
    } else {
      // Process the response from actual service
      const responseData = response.data;
      
      // Handle TartuNLP API format
      if (responseData.result && Array.isArray(responseData.result)) {
        rawEntities = parseTartuNLPResponse(responseData.result, text);
      } else {
        // Handle other API formats
        rawEntities = responseData.entities || responseData || [];
      }
    }

    // Transform and enrich entities with additional analysis
    const enrichedEntities = rawEntities.map((entity: any) => {
      const analysis = analyzeEntityPotentialIssues(entity, text);
      const context = getEntityContext(entity, text);
      
      return {
        ...entity,
        potentialIssues: analysis.potentialIssues,
        suggestions: analysis.suggestions,
        confidence: analysis.confidence,
        context,
        // Add metadata for agent processing
        metadata: {
          entityType: entity.label,
          length: entity.text.length,
          wordCount: entity.text.split(' ').length,
          hasSpecialChars: /[^a-zA-ZäöüõšžÄÖÜÕŠŽ\s]/.test(entity.text),
          isAllCaps: entity.text === entity.text.toUpperCase() && entity.text.length > 1,
          isAllLower: entity.text === entity.text.toLowerCase() && entity.text.length > 1
        }
      };
    });

    // Generate summary statistics for the agent
    const summary = {
      totalEntities: enrichedEntities.length,
      entityTypes: enrichedEntities.reduce((acc: Record<string, number>, entity) => {
        acc[entity.label] = (acc[entity.label] || 0) + 1;
        return acc;
      }, {}),
      entitiesWithIssues: enrichedEntities.filter(e => e.potentialIssues.length > 0).length,
      highConfidenceEntities: enrichedEntities.filter(e => e.confidence === 'high').length,
      lowConfidenceEntities: enrichedEntities.filter(e => e.confidence === 'low').length,
      averageEntityLength: enrichedEntities.length > 0 
        ? enrichedEntities.reduce((sum, e) => sum + e.text.length, 0) / enrichedEntities.length 
        : 0
    };

    const result: NERResponse = {
      entities: enrichedEntities,
      text,
      language,
      processing_time: response.data.processing_time || Date.now(),
      summary,
      fallback: false
    };

    return json(result);

  } catch (error) {
    console.error('NER API error:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || error.message || 'NER service error';
      
      return json(
        { 
          error: message,
          details: error.response?.data,
          status 
        },
        { status }
      );
    }

    return json(
      { error: 'Internal server error during NER processing' },
      { status: 500 }
    );
  }
};

// GET endpoint for health check
export const GET: RequestHandler = async () => {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    const config = isDev ? NER_CONFIG.development : NER_CONFIG.production;
    
    // Simple health check - don't fail if external service is down
    try {
      const response = await axios.get(config.url.replace('/ner', '/health').replace('/bert/ner/v1', '/health'), {
        timeout: 5000
      });
      
      return json({
        status: 'healthy',
        service: isDev ? 'tartunlp' : 'local',
        url: config.url
      });
    } catch (healthError) {
      // Service might be down, but we can still function
      return json({
        status: 'degraded',
        service: isDev ? 'tartunlp' : 'local',
        url: config.url,
        warning: 'External service unavailable, but API is functional'
      });
    }
  } catch (error) {
    return json({
      status: 'unhealthy',
      error: 'NER service not responding'
    }, { status: 503 });
  }
};

// Fallback NER results for testing when service is unavailable
function generateFallbackNERResults(text: string): any[] {
  const entities = [];
  
  // Simple entity detection for Estonian text
  const words = text.split(' ');
  
  // Look for potential organizations (words ending with common Estonian org suffixes)
  const orgPatterns = ['Ülikool', 'Akadeemia', 'Kool', 'Firma', 'AS', 'OÜ'];
  const personPatterns = ['Tiit', 'Mart', 'Jaan', 'Mari', 'Anna'];
  const locationPatterns = ['Tallinn', 'Tartu', 'Pärnu', 'Narva'];
  
  words.forEach((word, index) => {
    const cleanWord = word.replace(/[.,!?]/g, '');
    let entity = null;
    if (orgPatterns.some(pattern => cleanWord.includes(pattern))) {
      entity = {
        text: cleanWord,
        label: 'ORG',
        start: text.indexOf(cleanWord),
        end: text.indexOf(cleanWord) + cleanWord.length,
        confidence: 0.8
      };
    } else if (personPatterns.some(pattern => cleanWord.includes(pattern))) {
      entity = {
        text: cleanWord,
        label: 'PERSON',
        start: text.indexOf(cleanWord),
        end: text.indexOf(cleanWord) + cleanWord.length,
        confidence: 0.7
      };
    } else if (locationPatterns.some(pattern => cleanWord.includes(pattern))) {
      entity = {
        text: cleanWord,
        label: 'LOC',
        start: text.indexOf(cleanWord),
        end: text.indexOf(cleanWord) + cleanWord.length,
        confidence: 0.9
      };
    }
    if (entity) {
      entity.potentialIssues = [];
      entity.suggestions = [];
      entity.context = { before: '', after: '', fullContext: '' };
      entity.metadata = {
        wordCount: entity.text.split(' ').length,
        characterCount: entity.text.length,
        hasTimestamps: false,
        marks: [],
        confidence: entity.confidence
      };
      entities.push(entity);
    }
  });
  
  return entities;
} 