import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { text, language = 'et' } = body;

    if (!text || typeof text !== 'string') {
      return json(
        { error: 'Invalid request: text is required and must be a string' },
        { status: 400 }
      );
    }

    // Simple fallback NER results for testing
    const entities = [];
    const words = text.split(' ');
    
    const orgPatterns = ['Ülikool', 'Akadeemia', 'Kool', 'Firma', 'AS', 'OÜ'];
    const personPatterns = ['Tiit', 'Mart', 'Jaan', 'Mari', 'Anna'];
    const locationPatterns = ['Tallinn', 'Tartu', 'Pärnu', 'Narva'];
    
    words.forEach((word) => {
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

    const result = {
      entities,
      text,
      language,
      processing_time: Date.now(),
      summary: {
        totalEntities: entities.length,
        entityTypes: entities.reduce((acc: Record<string, number>, entity) => {
          acc[entity.label] = (acc[entity.label] || 0) + 1;
          return acc;
        }, {}),
        entitiesWithIssues: 0,
        highConfidenceEntities: entities.length,
        lowConfidenceEntities: 0,
        averageEntityLength: entities.length > 0 
          ? entities.reduce((sum, e) => sum + e.text.length, 0) / entities.length 
          : 0
      },
      fallback: true
    };

    return json(result);

  } catch (error) {
    console.error('Simple NER API error:', error);
    return json(
      { error: 'Internal server error during NER processing' },
      { status: 500 }
    );
  }
};

export const GET: RequestHandler = async () => {
  return json({
    status: 'healthy',
    service: 'simple-ner-fallback',
    message: 'Simple NER test endpoint is working'
  });
}; 