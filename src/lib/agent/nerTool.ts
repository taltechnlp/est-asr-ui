import { Tool } from '@langchain/core/tools';
import axios from 'axios';

/**
 * LangChain Tool for Named Entity Recognition
 * This tool can be used by the AI agent to analyze entities in ASR transcripts
 * and identify potential errors or issues.
 */

interface NEREntity {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence?: number | 'high' | 'medium' | 'low';
  potentialIssues: string[];
  suggestions: string[];
  context: {
    before: string;
    after: string;
    fullContext: string;
  };
  metadata: {
    entityType: string;
    length: number;
    wordCount: number;
    hasSpecialChars: boolean;
    isAllCaps: boolean;
    isAllLower: boolean;
  };
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
}

export class NERTool extends Tool {
  name = 'ner_analysis';
  description = `
    Analyze text for named entities and identify potential ASR errors.
    Use this tool when you need to:
    - Identify proper nouns, organizations, locations, and other entities in text
    - Find entities that might be misspelled or misrecognized by ASR
    - Get context around entities to understand their usage
    - Prioritize which entities need correction based on confidence and issues
    
    Input should be a JSON string with 'text' (required) and 'language' (optional, defaults to 'et').
    Example: {"text": "Tallinna Ülikooli rektor Tiit Land", "language": "et"}
  `;

  private apiUrl: string;

  constructor(apiUrl: string = '/api/tools/ner') {
    super();
    this.apiUrl = apiUrl;
  }

  protected async _call(input: string): Promise<string> {
    try {
      // Parse input
      const parsedInput = JSON.parse(input);
      const { text, language = 'et' } = parsedInput;

      if (!text || typeof text !== 'string') {
        throw new Error('Text parameter is required and must be a string');
      }

      // Call NER API - use relative URL for server-side calls
      const apiUrl = this.apiUrl.startsWith('http') ? this.apiUrl : `http://localhost:5173${this.apiUrl}`;
      
      const response = await axios.post(apiUrl, {
        text,
        language
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result: NERResponse = response.data;

      // Format response for the agent
      return this.formatResponse(result);

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`NER API error: ${error.response?.data?.error || error.message}`);
      }
      throw new Error(`NER tool error: ${error.message}`);
    }
  }

  private formatResponse(result: NERResponse): string {
    const { entities, summary } = result;
    
    let response = `NER Analysis Results:\n\n`;
    
    // Summary statistics
    if (summary) {
      response += `📊 Summary:\n`;
      response += `- Total entities: ${summary.totalEntities}\n`;
      response += `- Entity types: ${Object.entries(summary.entityTypes).map(([type, count]) => `${type}(${count})`).join(', ')}\n`;
      response += `- Entities with issues: ${summary.entitiesWithIssues}\n`;
      response += `- High confidence: ${summary.highConfidenceEntities}\n`;
      response += `- Low confidence: ${summary.lowConfidenceEntities}\n`;
      response += `- Average entity length: ${summary.averageEntityLength.toFixed(1)} characters\n\n`;
    }

    // Entity details
    if (entities.length === 0) {
      response += `📋 No entities detected in the text.\n`;
    } else {
      response += `📋 Detected Entities:\n\n`;
      
      // Group entities by confidence level for prioritization
      const highConfidence = entities.filter(e => e.confidence === 'high' || (typeof e.confidence === 'number' && e.confidence > 0.8));
      const mediumConfidence = entities.filter(e => e.confidence === 'medium' || (typeof e.confidence === 'number' && e.confidence >= 0.5 && e.confidence <= 0.8));
      const lowConfidence = entities.filter(e => e.confidence === 'low' || (typeof e.confidence === 'number' && e.confidence < 0.5));

      if (lowConfidence.length > 0) {
        response += `🔴 Low Confidence Entities (Priority for correction):\n`;
        lowConfidence.forEach(entity => {
          response += this.formatEntity(entity, 'low');
        });
        response += `\n`;
      }

      if (mediumConfidence.length > 0) {
        response += `🟡 Medium Confidence Entities:\n`;
        mediumConfidence.forEach(entity => {
          response += this.formatEntity(entity, 'medium');
        });
        response += `\n`;
      }

      if (highConfidence.length > 0) {
        response += `🟢 High Confidence Entities:\n`;
        highConfidence.forEach(entity => {
          response += this.formatEntity(entity, 'high');
        });
        response += `\n`;
      }
    }

    return response;
  }

  private formatEntity(entity: NEREntity, confidenceLevel: string): string {
    const confidenceIcon = confidenceLevel === 'low' ? '🔴' : confidenceLevel === 'medium' ? '🟡' : '🟢';
    
    let formatted = `${confidenceIcon} "${entity.text}" (${entity.label})\n`;
    formatted += `   Position: ${entity.start}-${entity.end}\n`;
    
    if (entity.potentialIssues.length > 0) {
      formatted += `   Issues: ${entity.potentialIssues.join(', ')}\n`;
      if (entity.suggestions.length > 0) {
        formatted += `   Suggestions: ${entity.suggestions.join(', ')}\n`;
      }
    }
    
    formatted += `   Context: "...${entity.context.before.slice(-30)}[${entity.text}]${entity.context.after.slice(0, 30)}..."\n`;
    formatted += `   Metadata: ${entity.metadata.wordCount} words, ${entity.metadata.length} chars`;
    
    if (entity.metadata.hasSpecialChars) formatted += `, has special chars`;
    if (entity.metadata.isAllCaps) formatted += `, ALL CAPS`;
    if (entity.metadata.isAllLower) formatted += `, all lower`;
    
    formatted += `\n\n`;
    
    return formatted;
  }

  /**
   * Helper method to get problematic entities for the agent
   */
  static async getProblematicEntities(text: string, language: string = 'et', apiUrl: string = '/api/tools/ner'): Promise<NEREntity[]> {
    try {
      const response = await axios.post(apiUrl, {
        text,
        language
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result: NERResponse = response.data;
      
      // Return entities with issues or low confidence
      return result.entities.filter(entity => 
        entity.confidence === 'low' || 
        (typeof entity.confidence === 'number' && entity.confidence < 0.5) ||
        entity.potentialIssues.length > 0
      );
    } catch (error) {
      console.error('Error getting problematic entities:', error);
      return [];
    }
  }

  /**
   * Helper method to get entity suggestions for correction
   */
  static async getEntitySuggestions(entity: NEREntity, context: string): Promise<string[]> {
    // This could be enhanced with web search or other correction methods
    const suggestions: string[] = [];
    
    // Basic suggestions based on detected issues
    if (entity.potentialIssues.includes('repeated_characters')) {
      // Remove repeated characters
      const cleaned = entity.text.replace(/(.)\1+/g, '$1');
      if (cleaned !== entity.text) {
        suggestions.push(cleaned);
      }
    }
    
    if (entity.potentialIssues.includes('mixed_case')) {
      // Suggest proper case
      const properCase = entity.text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      if (properCase !== entity.text) {
        suggestions.push(properCase);
      }
    }
    
    return suggestions;
  }
}

// Export a factory function for easy creation
export function createNERTool(apiUrl?: string): NERTool {
  return new NERTool(apiUrl);
}