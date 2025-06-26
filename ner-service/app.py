#!/usr/bin/env python3
"""
Local NER Service for Estonian ASR
This service provides Named Entity Recognition capabilities for Estonian text.
In production, this can replace the TartuNLP API for better control and performance.
"""

import os
import json
import time
import logging
from typing import List, Dict, Any, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables for model and cache
ner_pipeline = None
redis_client = None

def load_ner_model():
    """Load the NER model. In production, you would use a proper Estonian NER model."""
    global ner_pipeline
    
    try:
        # For demonstration, using a multilingual model
        # In production, replace with a proper Estonian NER model
        model_name = "dbmdz/bert-base-multilingual-cased-finetuned-conll03-english"
        
        logger.info(f"Loading NER model: {model_name}")
        ner_pipeline = pipeline(
            "ner",
            model=model_name,
            aggregation_strategy="simple"
        )
        logger.info("NER model loaded successfully")
        
    except Exception as e:
        logger.error(f"Failed to load NER model: {e}")
        raise

def init_redis():
    """Initialize Redis connection for caching."""
    global redis_client
    
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        redis_client = redis.from_url(redis_url, decode_responses=True)
        redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")
        redis_client = None

def get_cache_key(text: str, language: str) -> str:
    """Generate cache key for NER results."""
    import hashlib
    text_hash = hashlib.md5(text.encode()).hexdigest()
    return f"ner:{language}:{text_hash}"

def get_cached_result(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get cached NER result."""
    if not redis_client:
        return None
    
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Cache retrieval failed: {e}")
    
    return None

def cache_result(cache_key: str, result: Dict[str, Any], ttl: int = 3600):
    """Cache NER result."""
    if not redis_client:
        return
    
    try:
        redis_client.setex(cache_key, ttl, json.dumps(result))
    except Exception as e:
        logger.warning(f"Cache storage failed: {e}")

def process_entities(entities: List[Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
    """Process and enrich entities with additional analysis."""
    processed_entities = []
    
    for entity in entities:
        # Add position information if not present
        if 'start' not in entity or 'end' not in entity:
            # Find position in text
            start = text.find(entity['word'])
            end = start + len(entity['word']) if start != -1 else 0
            entity['start'] = start
            entity['end'] = end
        
        # Add confidence if not present
        if 'score' in entity and 'confidence' not in entity:
            entity['confidence'] = entity['score']
        
        # Standardize entity text
        entity['text'] = entity.get('word', entity.get('text', ''))
        
        # Add metadata
        entity['metadata'] = {
            'entityType': entity.get('entity_group', entity.get('label', '')),
            'length': len(entity['text']),
            'wordCount': len(entity['text'].split()),
            'hasSpecialChars': any(c not in 'abcdefghijklmnopqrstuvwxyzäöüõšžABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜÕŠŽ ' for c in entity['text']),
            'isAllCaps': entity['text'].isupper() and len(entity['text']) > 1,
            'isAllLower': entity['text'].islower() and len(entity['text']) > 1
        }
        
        processed_entities.append(entity)
    
    return processed_entities

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'local-ner',
        'model_loaded': ner_pipeline is not None,
        'redis_connected': redis_client is not None if redis_client else False
    })

@app.route('/ner', methods=['POST'])
def ner_endpoint():
    """Main NER processing endpoint."""
    start_time = time.time()
    
    try:
        # Parse request
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text parameter'}), 400
        
        text = data['text']
        language = data.get('language', 'et')
        
        if not isinstance(text, str) or not text.strip():
            return jsonify({'error': 'Text must be a non-empty string'}), 400
        
        # Check cache
        cache_key = get_cache_key(text, language)
        cached_result = get_cached_result(cache_key)
        
        if cached_result:
            logger.info("Returning cached NER result")
            return jsonify(cached_result)
        
        # Process with NER model
        if not ner_pipeline:
            return jsonify({'error': 'NER model not loaded'}), 503
        
        logger.info(f"Processing NER for {len(text)} characters")
        raw_entities = ner_pipeline(text)
        
        # Process and enrich entities
        processed_entities = process_entities(raw_entities, text)
        
        # Generate summary
        summary = {
            'totalEntities': len(processed_entities),
            'entityTypes': {},
            'entitiesWithIssues': 0,
            'highConfidenceEntities': 0,
            'lowConfidenceEntities': 0,
            'averageEntityLength': 0
        }
        
        for entity in processed_entities:
            entity_type = entity['metadata']['entityType']
            summary['entityTypes'][entity_type] = summary['entityTypes'].get(entity_type, 0) + 1
            
            confidence = entity.get('confidence', 0)
            if confidence > 0.8:
                summary['highConfidenceEntities'] += 1
            elif confidence < 0.5:
                summary['lowConfidenceEntities'] += 1
        
        if processed_entities:
            summary['averageEntityLength'] = sum(len(e['text']) for e in processed_entities) / len(processed_entities)
        
        # Prepare response
        result = {
            'entities': processed_entities,
            'text': text,
            'language': language,
            'processing_time': time.time() - start_time,
            'summary': summary
        }
        
        # Cache result
        cache_result(cache_key, result)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"NER processing error: {e}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with service information."""
    return jsonify({
        'service': 'Estonian NER Service',
        'version': '1.0.0',
        'endpoints': {
            'health': '/health',
            'ner': '/ner (POST)'
        },
        'model_loaded': ner_pipeline is not None
    })

if __name__ == '__main__':
    # Load model on startup
    load_ner_model()
    
    # Initialize Redis
    init_redis()
    
    # Run the application
    port = int(os.getenv('PORT', 8000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting NER service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 