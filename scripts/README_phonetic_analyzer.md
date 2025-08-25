# Estonian Phonetic Analyzer

This directory contains the implementation of the **phonetic_analyzer** tool as specified in `theory.md`. The tool provides phonetic analysis capabilities for Estonian ASR error correction.

## Files

- **`phonetic_analyzer.py`** - Main Python script implementing phonetic encoding and similarity analysis
- **`requirements.txt`** - Python dependencies (currently minimal, with optional et-g2p-fst support)
- **`setup_phonetic_analyzer.sh`** - Setup script to configure and test the tool
- **`test_phonetic_analyzer.py`** - Comprehensive test suite for the phonetic analyzer
- **`test_nodejs_integration.js`** - Node.js integration tests

## Features

### Core Functionality

1. **Phonetic Encoding** - Converts Estonian text to phonetic representations
2. **Similarity Analysis** - Calculates phonetic similarity between word pairs
3. **ASR Error Detection** - Identifies likely ASR transcription errors based on phonetic similarity

### Implementation Details

- **Fallback Support** - Works without et-g2p-fst using rule-based Estonian phonetic conversion
- **Full Integration** - Designed to work with et-g2p-fst when available for enhanced accuracy
- **Estonian-Specific** - Handles Estonian diacritics (õ, ä, ö, ü) and phonetic patterns
- **Robust Error Handling** - Graceful degradation when dependencies are unavailable

## Usage

### Command Line Interface

```bash
# Encode a word to phonetic representation
python3 phonetic_analyzer.py encode "tere"

# Calculate similarity between two words
python3 phonetic_analyzer.py similarity "protocol" "prototype"

# Full analysis (recommended for ASR error detection)
python3 phonetic_analyzer.py analyze "käima" "kaima"
```

### Node.js Integration

The tool is integrated into the coordinating agent via `PhoneticAnalyzerTool` in:
`src/lib/agents/tools/phoneticAnalyzer.ts`

## Test Results

When running the test suite, you should see results like:

```
📝 Test: Estonian diacritic confusion
   Original: 'käima' vs Candidate: 'kaima'
   📊 Similarity: 0.760
   🎯 Confidence: medium
   🚨 Likely ASR error: True
   ✅ PASSED: Valid response structure
```

## Setup Instructions

1. **Basic Setup** (fallback mode):

   ```bash
   chmod +x setup_phonetic_analyzer.sh
   ./setup_phonetic_analyzer.sh
   ```

2. **Full Setup** (with et-g2p-fst):

   ```bash
   # Install pynini
   pip install pynini

   # Clone and setup et-g2p-fst
   git clone https://github.com/alumae/et-g2p-fst.git
   cd et-g2p-fst
   # Follow setup instructions in the repository
   ```

## Integration with Coordinating Agent

The phonetic analyzer is automatically used by the coordinating agent when:

1. **High-confidence suggestions** are generated with text replacements
2. **Phonetic similarity ≥ 0.7** boosts suggestion confidence
3. **ASR error patterns** are detected and flagged

### Example Integration Flow

1. Agent identifies potential error: "protocol"
2. Suggests correction: "prototype"
3. Phonetic analyzer calculates similarity: 0.583
4. Based on similarity, agent adjusts confidence and explanation
5. High similarity scores receive confidence boosts for auto-application

## Output Format

The tool returns structured JSON with:

```json
{
	"original_text": "käima",
	"candidate_text": "kaima",
	"original_phonetic": "K AE I M A",
	"candidate_phonetic": "K A I M A",
	"similarity_score": 0.76,
	"confidence": "medium",
	"is_homophone": false,
	"is_likely_asr_error": true,
	"phoneme_count_original": 5,
	"phoneme_count_candidate": 5,
	"method": "fallback"
}
```

## Performance Notes

- **Fallback mode**: Fast, works immediately with any Python 3 installation
- **et-g2p-fst mode**: More accurate but requires additional setup
- **Caching**: Results could be cached for frequently analyzed word pairs
- **Timeout**: Node.js wrapper includes 10-second timeout for safety

## Contributing

When adding new Estonian phonetic rules or improving the fallback implementation, ensure that:

1. Tests pass: `python3 test_phonetic_analyzer.py`
2. Integration works: `node test_nodejs_integration.js`
3. Estonian-specific patterns are preserved
4. Backward compatibility is maintained
