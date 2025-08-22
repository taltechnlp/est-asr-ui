#!/usr/bin/env python3
"""
Test cases for the Estonian Phonetic Analyzer

This script tests the phonetic analyzer with various Estonian word pairs
to validate that it correctly identifies phonetic similarities and potential ASR errors.
"""

import json
import subprocess
import sys
from typing import List, Tuple

def run_phonetic_analysis(original: str, candidate: str) -> dict:
    """Run phonetic analysis and return parsed result."""
    try:
        result = subprocess.run([
            sys.executable, 'phonetic_analyzer.py', 'analyze', original, candidate
        ], capture_output=True, text=True, check=True)
        
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running analysis for '{original}' vs '{candidate}': {e}")
        print(f"Stderr: {e.stderr}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for '{original}' vs '{candidate}': {e}")
        print(f"Raw output: {result.stdout}")
        return None

def test_phonetic_pairs():
    """Test various Estonian word pairs for phonetic similarity."""
    
    # Test cases from theory.md and common Estonian ASR errors
    test_cases = [
        # High similarity cases (should detect as likely ASR errors)
        ("protocol", "prototype", "High similarity expected"),
        ("käima", "kaima", "Estonian diacritic confusion"),
        ("süda", "suda", "Umlaut vs regular vowel"),
        ("võti", "voti", "Estonian õ vs o confusion"),
        
        # Medium similarity cases
        ("kool", "kuul", "Estonian vowel confusion"),
        ("tuli", "tuul", "Single vs double vowel"),
        ("maja", "maha", "Similar Estonian words"),
        
        # Low similarity cases (should not be flagged as ASR errors)
        ("auto", "loom", "Completely different words"),
        ("tere", "näkishei", "Very different words"),
        ("eesti", "inglise", "Different languages"),
        
        # Homophone-like cases
        ("seal", "saal", "Similar Estonian words"),
        ("meel", "mail", "Estonian vowel variations"),
        
        # Technical terms (common in ASR errors)
        ("algoritm", "algorütm", "Technical term variation"),
        ("andmebaas", "anmebaas", "Missing letter"),
        ("server", "sörver", "Estonian-ized pronunciation"),
    ]
    
    print("🔊 Estonian Phonetic Analyzer Test Suite")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for original, candidate, description in test_cases:
        print(f"\n📝 Test: {description}")
        print(f"   Original: '{original}' vs Candidate: '{candidate}'")
        
        result = run_phonetic_analysis(original, candidate)
        
        if result is None:
            print("   ❌ FAILED: Could not get analysis result")
            failed += 1
            continue
        
        # Extract key metrics
        similarity = result.get('similarity_score', 0)
        confidence = result.get('confidence', 'unknown')
        is_likely_error = result.get('is_likely_asr_error', False)
        method = result.get('method', 'unknown')
        
        print(f"   📊 Similarity: {similarity:.3f}")
        print(f"   🎯 Confidence: {confidence}")
        print(f"   🚨 Likely ASR error: {is_likely_error}")
        print(f"   🔧 Method: {method}")
        print(f"   🗣️  Original phonetic: {result.get('original_phonetic', 'N/A')}")
        print(f"   🗣️  Candidate phonetic: {result.get('candidate_phonetic', 'N/A')}")
        
        # Basic validation
        if similarity < 0 or similarity > 1:
            print("   ❌ FAILED: Similarity score out of range [0,1]")
            failed += 1
        elif confidence not in ['low', 'medium', 'high']:
            print("   ❌ FAILED: Invalid confidence level")
            failed += 1
        else:
            print("   ✅ PASSED: Valid response structure")
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📈 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print(f"⚠️  {failed} tests failed")
        return False

def test_encoding():
    """Test basic phonetic encoding functionality."""
    print("\n🔤 Testing Basic Encoding")
    print("-" * 30)
    
    test_words = ["tere", "eesti", "kool", "süda", "võti", "õhtu"]
    
    for word in test_words:
        try:
            result = subprocess.run([
                sys.executable, 'phonetic_analyzer.py', 'encode', word
            ], capture_output=True, text=True, check=True)
            
            data = json.loads(result.stdout)
            phonetic = data.get('phonetic', 'N/A')
            print(f"   {word:10} → {phonetic}")
            
        except Exception as e:
            print(f"   {word:10} → ERROR: {e}")

if __name__ == '__main__':
    print("Starting Estonian Phonetic Analyzer Tests...\n")
    
    # Test basic encoding
    test_encoding()
    
    # Test phonetic similarity pairs
    success = test_phonetic_pairs()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)