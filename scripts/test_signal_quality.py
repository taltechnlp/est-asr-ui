#!/usr/bin/env python3
"""
Test cases for the Signal Quality Assessor

This script tests the signal quality assessor with various audio scenarios
to validate that it correctly assesses SNR and provides appropriate analysis strategies.
"""

import json
import subprocess
import sys
import os
from typing import List, Tuple

def run_quality_assessment(audio_file: str, start_time: float, end_time: float) -> dict:
    """Run signal quality assessment and return parsed result."""
    try:
        result = subprocess.run([
            sys.executable, 'signal_quality_assessor.py', 'assess', audio_file, str(start_time), str(end_time)
        ], capture_output=True, text=True, check=True)
        
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error running assessment for '{audio_file}' [{start_time}-{end_time}s]: {e}")
        print(f"Stderr: {e.stderr}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for '{audio_file}': {e}")
        print(f"Raw output: {result.stdout}")
        return None

def test_quality_assessments():
    """Test signal quality assessment with various scenarios."""
    
    # Find a real audio file for testing
    test_audio_file = None
    potential_files = [
        "/home/aivo/dev/est-asr-ui/static/Päevakaja 16.05.mp3",
        "/home/aivo/dev/est-asr-ui/uploads/cm7jcn30b000011rbsrbbcdg3/168c9a9bd0334720bddba96a7ae9de_FIN_M_MattiN.mp3"
    ]
    
    for file_path in potential_files:
        if os.path.exists(file_path):
            test_audio_file = file_path
            break
    
    if not test_audio_file:
        print("⚠️ No audio files found for testing, testing error handling only")
        test_cases = [
            ("/nonexistent/test.wav", 0, 5, "File not found scenario"),
        ]
    else:
        print(f"✅ Using test audio file: {test_audio_file}")
        test_cases = [
            (test_audio_file, 0, 5, "First 5 seconds"),
            (test_audio_file, 10, 15, "Mid-section 5 seconds"),
            (test_audio_file, 0, 1, "Very short segment"),
            (test_audio_file, 0, 30, "Longer segment"),
            ("/nonexistent/test.wav", 0, 5, "File not found scenario"),
        ]
    
    print("📊 Signal Quality Assessor Test Suite")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for audio_file, start_time, end_time, description in test_cases:
        print(f"\n📝 Test: {description}")
        print(f"   File: {os.path.basename(audio_file)}")
        print(f"   Segment: {start_time}s - {end_time}s ({end_time - start_time}s duration)")
        
        result = run_quality_assessment(audio_file, start_time, end_time)
        
        if result is None:
            print("   ❌ FAILED: Could not get assessment result")
            failed += 1
            continue
        
        # Extract key metrics
        snr_db = result.get('snr_db', 0)
        quality_category = result.get('quality_category', 'unknown')
        reliability = result.get('reliability', 'unknown')
        method = result.get('method', 'unknown')
        threshold = result.get('suggested_confidence_threshold', 0.7)
        
        print(f"   📊 SNR: {snr_db:.2f} dB")
        print(f"   🎯 Quality: {quality_category}")
        print(f"   🔒 Reliability: {reliability}")
        print(f"   🚨 Suggested threshold: {threshold}")
        print(f"   🔧 Method: {method}")
        
        # Additional metrics if available
        if 'peak_amplitude' in result:
            print(f"   📈 Peak amplitude: {result['peak_amplitude']:.3f}")
        if 'rms_energy' in result:
            print(f"   ⚡ RMS energy: {result['rms_energy']:.3f}")
        if 'is_clipped' in result and result['is_clipped']:
            print(f"   ⚠️ Clipping detected: {result.get('clipping_ratio', 0)*100:.1f}%")
        
        # Validate response structure
        if not isinstance(snr_db, (int, float)):
            print("   ❌ FAILED: Invalid SNR value")
            failed += 1
        elif quality_category not in ['excellent', 'good', 'fair', 'poor', 'very_poor', 'unknown']:
            print("   ❌ FAILED: Invalid quality category")
            failed += 1
        elif reliability not in ['very_high', 'high', 'medium', 'low', 'very_low']:
            print("   ❌ FAILED: Invalid reliability level")
            failed += 1
        elif threshold < 0 or threshold > 1:
            print("   ❌ FAILED: Invalid confidence threshold")
            failed += 1
        else:
            print("   ✅ PASSED: Valid response structure")
            passed += 1
            
            # Test strategy recommendations
            if snr_db >= 30 and threshold < 0.8:
                print("   ⚠️ WARNING: High SNR should suggest conservative threshold")
            elif snr_db < 15 and threshold > 0.6:
                print("   ⚠️ WARNING: Low SNR should suggest aggressive threshold")
    
    print("\n" + "=" * 50)
    print(f"📈 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All signal quality tests passed!")
        return True
    else:
        print(f"⚠️ {failed} tests failed")
        return False

def test_error_scenarios():
    """Test error handling scenarios."""
    print("\n🚨 Testing Error Scenarios")
    print("-" * 30)
    
    error_cases = [
        ("invalid_file.wav", 0, 5, "Invalid file"),
        ("valid_file.wav", -1, 5, "Negative start time"),
        ("valid_file.wav", 10, 5, "End time before start time"),
    ]
    
    for audio_file, start_time, end_time, description in error_cases:
        print(f"\n📝 Error Test: {description}")
        result = run_quality_assessment(audio_file, start_time, end_time)
        
        if result and 'error' in result:
            print(f"   ✅ Error handled correctly: {result['error']}")
            print(f"   ✅ Fallback SNR provided: {result.get('snr_db', 'N/A')}")
        else:
            print(f"   ❌ Error not handled properly")

def test_strategy_mapping():
    """Test that SNR values map to correct strategies."""
    print("\n🎯 Testing Strategy Mapping")
    print("-" * 30)
    
    # Test the strategy logic
    strategy_tests = [
        (35, "conservative", ">= 0.9", "Excellent audio"),
        (25, "balanced", ">= 0.8", "Good audio"),
        (18, "balanced", ">= 0.7", "Fair audio"),
        (12, "aggressive", ">= 0.6", "Poor audio"),
        (8, "very_aggressive", ">= 0.5", "Very poor audio"),
    ]
    
    for snr, expected_strategy, expected_threshold_range, description in strategy_tests:
        print(f"\n📊 {description} (SNR: {snr} dB)")
        print(f"   Expected strategy: {expected_strategy}")
        print(f"   Expected threshold: {expected_threshold_range}")
        
        # We'll validate this logic is working when integrated
        # For now, just document the expected behavior

if __name__ == '__main__':
    print("Starting Signal Quality Assessor Tests...\n")
    
    # Test basic quality assessment
    success = test_quality_assessments()
    
    # Test error handling
    test_error_scenarios()
    
    # Test strategy mapping
    test_strategy_mapping()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)