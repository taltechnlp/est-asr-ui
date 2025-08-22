#!/usr/bin/env python3
"""
Estonian Phonetic Analyzer Script

This script provides phonetic encoding and similarity analysis for Estonian text
using the et-g2p-fst (Estonian Grapheme-to-Phoneme Finite State Transducer) library.

It implements the phonetic_analyzer tool as specified in theory.md:
- phonetic_encode(word): Convert text to ARPAbet-style phonetic representation
- phonetic_similarity(phonetic1, phonetic2): Calculate similarity score using phonetic edit distance

Usage:
    python phonetic_analyzer.py encode <word>
    python phonetic_analyzer.py similarity <word1> <word2>
    python phonetic_analyzer.py analyze <original_text> <candidate_text>
"""

import sys
import json
import argparse
import re
from typing import Dict, List, Tuple, Any
import difflib

# Try to import et-g2p-fst dependencies
try:
    import pynini
    ET_G2P_AVAILABLE = True
except ImportError:
    ET_G2P_AVAILABLE = False
    print("Warning: Pynini not available. Using fallback phonetic conversion.", file=sys.stderr)

try:
    # This would be the actual et-g2p-fst import once installed
    # from et_g2p_fst import G2P
    G2P_AVAILABLE = False  # Set to True when et-g2p-fst is properly installed
except ImportError:
    G2P_AVAILABLE = False


class EstonianPhoneticAnalyzer:
    """Estonian phonetic analyzer using et-g2p-fst or fallback methods."""
    
    def __init__(self):
        """Initialize the phonetic analyzer."""
        self.g2p_model = None
        
        # Initialize the actual g2p model if available
        if G2P_AVAILABLE and ET_G2P_AVAILABLE:
            try:
                # This would be the actual initialization once et-g2p-fst is installed
                # self.g2p_model = G2P()
                pass
            except Exception as e:
                print(f"Warning: Failed to initialize et-g2p-fst model: {e}", file=sys.stderr)
                
        # Fallback Estonian phonetic mapping based on common patterns
        self.estonian_phoneme_map = {
            'a': 'A', 'aa': 'A:', 'e': 'E', 'ee': 'E:', 'i': 'I', 'ii': 'I:',
            'o': 'O', 'oo': 'O:', 'u': 'U', 'uu': 'U:', 'õ': 'Y', 'õõ': 'Y:',
            'ä': 'AE', 'ää': 'AE:', 'ö': 'OE', 'öö': 'OE:', 'ü': 'UE', 'üü': 'UE:',
            'b': 'B', 'c': 'TS', 'd': 'D', 'f': 'F', 'g': 'G', 'h': 'H',
            'j': 'J', 'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'p': 'P',
            'r': 'R', 's': 'S', 't': 'T', 'v': 'V', 'w': 'V', 'z': 'S',
            'š': 'SH', 'ž': 'ZH', 'x': 'KS', 'y': 'UE', 'q': 'K'
        }
        
    def phonetic_encode(self, text: str) -> str:
        """
        Convert Estonian text to phonetic representation.
        
        Args:
            text: Input text in Estonian
            
        Returns:
            Phonetic representation string (ARPAbet-style)
        """
        text = text.lower().strip()
        
        if self.g2p_model and G2P_AVAILABLE:
            # Use actual et-g2p-fst if available
            try:
                # This would be the actual call once et-g2p-fst is installed
                # phonetic = self.g2p_model.convert(text)
                # return self._format_phonetic_output(phonetic)
                pass
            except Exception as e:
                print(f"Warning: et-g2p-fst conversion failed: {e}", file=sys.stderr)
                
        # Fallback to rule-based conversion
        return self._fallback_phonetic_encode(text)
    
    def _fallback_phonetic_encode(self, text: str) -> str:
        """
        Fallback phonetic encoding using Estonian phonetic rules.
        
        This is a simplified version that handles basic Estonian phonetic patterns.
        """
        text = text.lower()
        phonetic_parts = []
        
        i = 0
        while i < len(text):
            # Handle double letters first
            if i < len(text) - 1:
                double_char = text[i:i+2]
                if double_char in self.estonian_phoneme_map:
                    phonetic_parts.append(self.estonian_phoneme_map[double_char])
                    i += 2
                    continue
            
            # Handle single characters
            char = text[i]
            if char in self.estonian_phoneme_map:
                phonetic_parts.append(self.estonian_phoneme_map[char])
            elif char.isalpha():
                # Unknown letter, keep as uppercase
                phonetic_parts.append(char.upper())
            # Skip non-alphabetic characters
            
            i += 1
            
        return ' '.join(phonetic_parts)
    
    def _format_phonetic_output(self, phonetic: str) -> str:
        """Format phonetic output to ARPAbet-style space-separated format."""
        # This would process the actual et-g2p-fst output format
        # and convert it to space-separated ARPAbet-style format
        return phonetic.strip()
    
    def phonetic_similarity(self, phonetic1: str, phonetic2: str) -> float:
        """
        Calculate phonetic similarity between two phonetic representations.
        
        Args:
            phonetic1: First phonetic representation
            phonetic2: Second phonetic representation
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not phonetic1 or not phonetic2:
            return 0.0
            
        # Normalize phonetic representations
        phones1 = phonetic1.split()
        phones2 = phonetic2.split()
        
        if not phones1 or not phones2:
            return 0.0
        
        # Use sequence matcher for phoneme-level similarity
        matcher = difflib.SequenceMatcher(None, phones1, phones2)
        similarity = matcher.ratio()
        
        # Apply phonetic-specific scoring adjustments
        similarity = self._adjust_phonetic_similarity(phones1, phones2, similarity)
        
        return min(1.0, max(0.0, similarity))
    
    def _adjust_phonetic_similarity(self, phones1: List[str], phones2: List[str], base_similarity: float) -> float:
        """
        Apply Estonian-specific phonetic similarity adjustments.
        
        This accounts for phonetic features specific to Estonian language.
        """
        # Bonus for similar vowel patterns (important in Estonian)
        vowels1 = [p for p in phones1 if p in ['A', 'E', 'I', 'O', 'U', 'Y', 'AE', 'OE', 'UE']]
        vowels2 = [p for p in phones2 if p in ['A', 'E', 'I', 'O', 'U', 'Y', 'AE', 'OE', 'UE']]
        
        if vowels1 and vowels2:
            vowel_matcher = difflib.SequenceMatcher(None, vowels1, vowels2)
            vowel_similarity = vowel_matcher.ratio()
            # Weight vowel similarity higher for Estonian
            base_similarity = (base_similarity * 0.7) + (vowel_similarity * 0.3)
        
        # Penalty for very different lengths
        len_ratio = min(len(phones1), len(phones2)) / max(len(phones1), len(phones2))
        if len_ratio < 0.5:
            base_similarity *= 0.8
            
        return base_similarity
    
    def analyze_pair(self, original_text: str, candidate_text: str) -> Dict[str, Any]:
        """
        Analyze a pair of words for phonetic similarity.
        
        Args:
            original_text: Original word/phrase
            candidate_text: Candidate replacement word/phrase
            
        Returns:
            Dictionary containing phonetic analysis results
        """
        # Clean and normalize input
        original_clean = re.sub(r'[^\w\s]', '', original_text).strip()
        candidate_clean = re.sub(r'[^\w\s]', '', candidate_text).strip()
        
        # Get phonetic representations
        original_phonetic = self.phonetic_encode(original_clean)
        candidate_phonetic = self.phonetic_encode(candidate_clean)
        
        # Calculate similarity
        similarity_score = self.phonetic_similarity(original_phonetic, candidate_phonetic)
        
        # Determine confidence level
        confidence = "high" if similarity_score >= 0.8 else "medium" if similarity_score >= 0.6 else "low"
        
        # Additional analysis
        is_homophone = similarity_score >= 0.95
        is_likely_error = similarity_score >= 0.7 and similarity_score < 0.95
        
        return {
            "original_text": original_text,
            "candidate_text": candidate_text,
            "original_phonetic": original_phonetic,
            "candidate_phonetic": candidate_phonetic,
            "similarity_score": round(similarity_score, 3),
            "confidence": confidence,
            "is_homophone": is_homophone,
            "is_likely_asr_error": is_likely_error,
            "phoneme_count_original": len(original_phonetic.split()),
            "phoneme_count_candidate": len(candidate_phonetic.split()),
            "method": "et-g2p-fst" if G2P_AVAILABLE else "fallback"
        }


def main():
    """Command line interface for the phonetic analyzer."""
    parser = argparse.ArgumentParser(description='Estonian Phonetic Analyzer')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Encode command
    encode_parser = subparsers.add_parser('encode', help='Encode text to phonetic representation')
    encode_parser.add_argument('text', help='Text to encode')
    
    # Similarity command
    similarity_parser = subparsers.add_parser('similarity', help='Calculate phonetic similarity')
    similarity_parser.add_argument('text1', help='First text')
    similarity_parser.add_argument('text2', help='Second text')
    
    # Analyze command (main interface for the tool)
    analyze_parser = subparsers.add_parser('analyze', help='Analyze phonetic similarity between two texts')
    analyze_parser.add_argument('original', help='Original text')
    analyze_parser.add_argument('candidate', help='Candidate text')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    analyzer = EstonianPhoneticAnalyzer()
    
    try:
        if args.command == 'encode':
            result = analyzer.phonetic_encode(args.text)
            print(json.dumps({"phonetic": result}))
            
        elif args.command == 'similarity':
            phonetic1 = analyzer.phonetic_encode(args.text1)
            phonetic2 = analyzer.phonetic_encode(args.text2)
            similarity = analyzer.phonetic_similarity(phonetic1, phonetic2)
            print(json.dumps({
                "text1": args.text1,
                "text2": args.text2,
                "phonetic1": phonetic1,
                "phonetic2": phonetic2,
                "similarity": round(similarity, 3)
            }))
            
        elif args.command == 'analyze':
            result = analyzer.analyze_pair(args.original, args.candidate)
            print(json.dumps(result))
            
    except Exception as e:
        error_result = {
            "error": str(e),
            "command": args.command
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()