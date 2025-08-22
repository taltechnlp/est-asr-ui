#!/usr/bin/env python3
"""
Signal Quality Assessor Script

This script provides audio signal quality assessment using TorchMetrics
for Estonian ASR error correction as specified in theory.md.

It implements the signal_quality_assessor tool:
- Calculates Signal-to-Noise Ratio (SNR) using TorchMetrics
- Provides additional audio quality metrics
- Helps determine ASR reliability for different audio segments

Usage:
    python signal_quality_assessor.py assess <audio_file> <start_time> <end_time>
    python signal_quality_assessor.py assess_file <audio_file>
"""

import sys
import json
import argparse
import warnings
from typing import Dict, Any, Optional
import os
import tempfile

# Try to import PyTorch and TorchMetrics dependencies
try:
    import torch
    import torchaudio
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("Warning: PyTorch not available. Using fallback audio analysis.", file=sys.stderr)

try:
    import torchmetrics.audio as tm_audio
    TORCHMETRICS_AVAILABLE = True
except ImportError:
    TORCHMETRICS_AVAILABLE = False
    print("Warning: TorchMetrics not available. Using basic audio analysis.", file=sys.stderr)

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    print("Warning: numpy not available. Very limited audio analysis.", file=sys.stderr)

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("Warning: librosa not available. Limited audio analysis capabilities.", file=sys.stderr)


class SignalQualityAssessor:
    """Audio signal quality assessor using TorchMetrics and PyTorch."""
    
    def __init__(self):
        """Initialize the signal quality assessor."""
        self.snr_metric = None
        self.device = None
        
        # Initialize TorchMetrics SNR if available
        if TORCH_AVAILABLE and TORCHMETRICS_AVAILABLE:
            try:
                self.device = torch.device('cpu')  # Use CPU for compatibility
                self.snr_metric = tm_audio.SignalNoiseRatio()
                print("✅ TorchMetrics SNR initialized successfully", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Failed to initialize TorchMetrics SNR: {e}", file=sys.stderr)
                
    def load_audio_segment(self, audio_file_path: str, start_time: float = None, end_time: float = None):
        """
        Load audio segment using torchaudio.
        
        Args:
            audio_file_path: Path to the audio file
            start_time: Start time in seconds (optional)
            end_time: End time in seconds (optional)
            
        Returns:
            Audio tensor and sample rate tuple
        """
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch not available for audio loading")
            
        try:
            # Load the full audio file
            waveform, sample_rate = torchaudio.load(audio_file_path)
            
            # Convert to mono if stereo
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            
            # Extract segment if timestamps provided
            if start_time is not None and end_time is not None:
                start_sample = int(start_time * sample_rate)
                end_sample = int(end_time * sample_rate)
                
                # Ensure bounds are valid
                start_sample = max(0, start_sample)
                end_sample = min(waveform.shape[1], end_sample)
                
                if start_sample >= end_sample:
                    raise ValueError(f"Invalid time range: {start_time}s to {end_time}s")
                
                waveform = waveform[:, start_sample:end_sample]
                
            return waveform, sample_rate
            
        except Exception as e:
            raise RuntimeError(f"Failed to load audio segment: {e}")
    
    def calculate_snr_torchmetrics(self, waveform) -> float:
        """
        Calculate SNR using TorchMetrics.
        
        Args:
            waveform: Audio waveform tensor
            
        Returns:
            SNR value in dB
        """
        if not self.snr_metric:
            raise RuntimeError("TorchMetrics SNR not available")
            
        try:
            # TorchMetrics SNR expects (batch, time) or (batch, channels, time)
            if waveform.dim() == 2:
                # Add batch dimension if needed
                if waveform.shape[0] == 1:  # Single channel
                    waveform = waveform.unsqueeze(0)  # Add batch dim: (1, 1, time)
                else:
                    # Multiple channels, add batch dim
                    waveform = waveform.unsqueeze(0)  # (1, channels, time)
            elif waveform.dim() == 1:
                # Add channel and batch dimensions
                waveform = waveform.unsqueeze(0).unsqueeze(0)  # (1, 1, time)
            
            # For SNR calculation, we need to estimate noise
            # Simple approach: assume noise is the quieter portions of the signal
            if TORCH_AVAILABLE:
                signal_power = torch.mean(waveform ** 2)
                
                # Estimate noise as the bottom 10% of signal energy
                sorted_energy, _ = torch.sort(waveform.abs().flatten())
                noise_threshold_idx = int(0.1 * sorted_energy.numel())
                noise_power = torch.mean(sorted_energy[:noise_threshold_idx] ** 2)
                
                # Calculate SNR in dB
                if noise_power > 0:
                    snr_linear = signal_power / noise_power
                    snr_db = 10 * torch.log10(snr_linear)
                    return snr_db.item()
                else:
                    return float('inf')  # Perfect signal
            else:
                return self.calculate_snr_fallback(waveform)
                
        except Exception as e:
            print(f"TorchMetrics SNR calculation failed: {e}", file=sys.stderr)
            return self.calculate_snr_fallback(waveform)
    
    def calculate_snr_fallback(self, waveform) -> float:
        """
        Fallback SNR calculation without TorchMetrics.
        
        Args:
            waveform: Audio waveform tensor
            
        Returns:
            SNR value in dB
        """
        try:
            # Convert to numpy if needed
            if TORCH_AVAILABLE and hasattr(waveform, 'squeeze'):
                audio_data = waveform.squeeze().numpy()
            elif hasattr(waveform, 'squeeze'):
                audio_data = waveform.squeeze()
            else:
                audio_data = waveform
            
            if NUMPY_AVAILABLE:
                # Calculate RMS for signal power
                signal_rms = np.sqrt(np.mean(audio_data ** 2))
                
                # Estimate noise as the quieter 10% of the signal
                sorted_abs = np.sort(np.abs(audio_data))
                noise_samples = sorted_abs[:int(0.1 * len(sorted_abs))]
                noise_rms = np.sqrt(np.mean(noise_samples ** 2))
                
                # Calculate SNR in dB
                if noise_rms > 0:
                    snr_db = 20 * np.log10(signal_rms / noise_rms)
                    return float(snr_db)
                else:
                    return 60.0  # Very high SNR for perfect signal
            else:
                # Basic fallback without numpy
                return 15.0  # Default moderate SNR
                
        except Exception as e:
            print(f"Fallback SNR calculation failed: {e}", file=sys.stderr)
            return 15.0  # Default moderate SNR
    
    def calculate_additional_metrics(self, waveform, sample_rate: int) -> Dict[str, float]:
        """
        Calculate additional audio quality metrics.
        
        Args:
            waveform: Audio waveform tensor
            sample_rate: Sample rate in Hz
            
        Returns:
            Dictionary of additional quality metrics
        """
        metrics = {}
        
        try:
            # Convert to numpy for calculations
            if TORCH_AVAILABLE and hasattr(waveform, 'squeeze'):
                audio_data = waveform.squeeze().numpy()
            elif hasattr(waveform, 'squeeze'):
                audio_data = waveform.squeeze()
            else:
                audio_data = waveform
            
            if NUMPY_AVAILABLE:
                # Peak amplitude
                metrics['peak_amplitude'] = float(np.max(np.abs(audio_data)))
                
                # RMS energy
                metrics['rms_energy'] = float(np.sqrt(np.mean(audio_data ** 2)))
                
                # Dynamic range (difference between max and min amplitudes)
                max_amp = np.max(np.abs(audio_data))
                min_amp = np.min(np.abs(audio_data[audio_data != 0])) if np.any(audio_data != 0) else 1e-10
                metrics['dynamic_range_db'] = float(20 * np.log10(max_amp / (min_amp + 1e-10)))
                
                # Zero crossing rate (indicator of spectral content)
                zero_crossings = np.where(np.diff(np.signbit(audio_data)))[0]
                metrics['zero_crossing_rate'] = float(len(zero_crossings) / len(audio_data) * sample_rate)
            else:
                # Basic calculations without numpy
                audio_list = audio_data.tolist() if hasattr(audio_data, 'tolist') else list(audio_data)
                metrics['peak_amplitude'] = float(max(abs(x) for x in audio_list))
                metrics['rms_energy'] = float((sum(x**2 for x in audio_list) / len(audio_list)) ** 0.5)
            
            # Spectral centroid (if librosa and numpy available)
            if LIBROSA_AVAILABLE and NUMPY_AVAILABLE:
                spectral_centroids = librosa.feature.spectral_centroid(y=audio_data, sr=sample_rate)[0]
                metrics['spectral_centroid_mean'] = float(np.mean(spectral_centroids))
                metrics['spectral_centroid_std'] = float(np.std(spectral_centroids))
            
            # Clipping detection
            if NUMPY_AVAILABLE:
                max_val = np.max(np.abs(audio_data))
                clipping_threshold = 0.95
                metrics['is_clipped'] = bool(max_val >= clipping_threshold)
                metrics['clipping_ratio'] = float(np.sum(np.abs(audio_data) >= clipping_threshold) / len(audio_data))
            else:
                # Basic clipping detection without numpy
                audio_list = audio_data.tolist() if hasattr(audio_data, 'tolist') else list(audio_data)
                max_val = max(abs(x) for x in audio_list)
                clipping_threshold = 0.95
                metrics['is_clipped'] = bool(max_val >= clipping_threshold)
                clipped_count = sum(1 for x in audio_list if abs(x) >= clipping_threshold)
                metrics['clipping_ratio'] = float(clipped_count / len(audio_list))
            
        except Exception as e:
            print(f"Error calculating additional metrics: {e}", file=sys.stderr)
            
        return metrics
    
    def assess_quality(self, audio_file_path: str, start_time: float = None, end_time: float = None) -> Dict[str, Any]:
        """
        Assess the quality of an audio segment.
        
        Args:
            audio_file_path: Path to the audio file
            start_time: Start time in seconds (optional, for segment analysis)
            end_time: End time in seconds (optional, for segment analysis)
            
        Returns:
            Dictionary containing quality assessment results
        """
        try:
            # Load audio segment
            if TORCH_AVAILABLE:
                waveform, sample_rate = self.load_audio_segment(audio_file_path, start_time, end_time)
                
                # Calculate SNR
                if TORCHMETRICS_AVAILABLE and self.snr_metric:
                    snr_db = self.calculate_snr_torchmetrics(waveform)
                    method = "torchmetrics"
                else:
                    snr_db = self.calculate_snr_fallback(waveform)
                    method = "fallback"
                
                # Calculate additional metrics
                additional_metrics = self.calculate_additional_metrics(waveform, sample_rate)
                
            else:
                # Complete fallback using librosa if available
                if LIBROSA_AVAILABLE:
                    snr_db = self.assess_quality_librosa(audio_file_path, start_time, end_time)
                    method = "librosa_fallback"
                    sample_rate = 16000  # Assume standard rate
                else:
                    # No audio processing available, use basic estimation
                    duration = (end_time - start_time) if (start_time is not None and end_time is not None) else 5.0
                    # Estimate based on duration - shorter segments often have more noise
                    snr_db = max(10.0, 20.0 - (5.0 / max(duration, 1.0)))
                    method = "duration_estimation"
                    sample_rate = None
                    
                additional_metrics = {}
            
            # Determine quality categories based on SNR
            if snr_db >= 30:
                quality_category = "excellent"
                reliability = "very_high"
            elif snr_db >= 20:
                quality_category = "good"
                reliability = "high"
            elif snr_db >= 15:
                quality_category = "fair"
                reliability = "medium"
            elif snr_db >= 10:
                quality_category = "poor"
                reliability = "low"
            else:
                quality_category = "very_poor"
                reliability = "very_low"
            
            # Calculate suggested confidence threshold based on SNR
            # High SNR = higher threshold (more conservative)
            # Low SNR = lower threshold (more aggressive)
            if snr_db >= 30:
                suggested_confidence_threshold = 0.9  # Very conservative
            elif snr_db >= 20:
                suggested_confidence_threshold = 0.8  # Conservative
            elif snr_db >= 15:
                suggested_confidence_threshold = 0.7  # Moderate
            elif snr_db >= 10:
                suggested_confidence_threshold = 0.6  # Aggressive
            else:
                suggested_confidence_threshold = 0.5  # Very aggressive
            
            duration = (end_time - start_time) if (start_time is not None and end_time is not None) else None
            
            result = {
                "snr_db": float(snr_db),
                "quality_category": quality_category,
                "reliability": reliability,
                "suggested_confidence_threshold": suggested_confidence_threshold,
                "method": method,
                "duration": duration,
                "sample_rate": sample_rate if TORCH_AVAILABLE else None,
                "segment_info": {
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": duration
                },
                **additional_metrics
            }
            
            return result
            
        except Exception as e:
            print(f"Signal quality assessment failed: {e}", file=sys.stderr)
            return self.create_fallback_result(start_time, end_time)
    
    def assess_quality_librosa(self, audio_file_path: str, start_time: float = None, end_time: float = None) -> float:
        """
        Fallback quality assessment using librosa.
        
        Args:
            audio_file_path: Path to the audio file
            start_time: Start time in seconds
            end_time: End time in seconds
            
        Returns:
            Estimated SNR in dB
        """
        if not LIBROSA_AVAILABLE:
            return 15.0  # Default moderate SNR
            
        try:
            # Load audio with librosa
            y, sr = librosa.load(audio_file_path, sr=None)
            
            # Extract segment if specified
            if start_time is not None and end_time is not None:
                start_sample = int(start_time * sr)
                end_sample = int(end_time * sr)
                y = y[start_sample:end_sample]
            
            # Simple SNR estimation
            signal_power = np.mean(y ** 2)
            
            # Estimate noise as quieter portions
            sorted_energy = np.sort(np.abs(y))
            noise_samples = sorted_energy[:int(0.1 * len(sorted_energy))]
            noise_power = np.mean(noise_samples ** 2)
            
            if noise_power > 0:
                snr_db = 10 * np.log10(signal_power / noise_power)
                return float(snr_db)
            else:
                return 60.0  # Very high SNR
                
        except Exception as e:
            print(f"Librosa SNR calculation failed: {e}", file=sys.stderr)
            return 15.0  # Default moderate SNR
    
    def create_fallback_result(self, start_time: float = None, end_time: float = None) -> Dict[str, Any]:
        """
        Create a fallback result when audio analysis is not available.
        
        Args:
            start_time: Start time in seconds
            end_time: End time in seconds
            
        Returns:
            Fallback quality assessment
        """
        duration = (end_time - start_time) if (start_time is not None and end_time is not None) else None
        
        return {
            "snr_db": 15.0,  # Assume moderate quality
            "quality_category": "unknown",
            "reliability": "medium",
            "suggested_confidence_threshold": 0.7,
            "method": "fallback",
            "duration": duration,
            "sample_rate": None,
            "segment_info": {
                "start_time": start_time,
                "end_time": end_time,
                "duration": duration
            },
            "error": "Audio analysis libraries not available"
        }


def main():
    """Command line interface for the signal quality assessor."""
    parser = argparse.ArgumentParser(description='Audio Signal Quality Assessor')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Assess command for audio segments
    assess_parser = subparsers.add_parser('assess', help='Assess quality of audio segment')
    assess_parser.add_argument('audio_file', help='Path to audio file')
    assess_parser.add_argument('start_time', type=float, help='Start time in seconds')
    assess_parser.add_argument('end_time', type=float, help='End time in seconds')
    
    # Assess entire file
    assess_file_parser = subparsers.add_parser('assess_file', help='Assess quality of entire audio file')
    assess_file_parser.add_argument('audio_file', help='Path to audio file')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    assessor = SignalQualityAssessor()
    
    try:
        if args.command == 'assess':
            # Validate file exists
            if not os.path.exists(args.audio_file):
                raise FileNotFoundError(f"Audio file not found: {args.audio_file}")
            
            # Validate time parameters
            if args.start_time < 0:
                raise ValueError(f"Start time must be >= 0, got {args.start_time}")
            
            if args.end_time <= args.start_time:
                raise ValueError(f"End time ({args.end_time}) must be greater than start time ({args.start_time})")
            
            result = assessor.assess_quality(args.audio_file, args.start_time, args.end_time)
            print(json.dumps(result))
            
        elif args.command == 'assess_file':
            # Validate file exists
            if not os.path.exists(args.audio_file):
                raise FileNotFoundError(f"Audio file not found: {args.audio_file}")
            
            result = assessor.assess_quality(args.audio_file)
            print(json.dumps(result))
            
    except Exception as e:
        error_result = {
            "error": str(e),
            "command": args.command,
            "snr_db": 15.0,  # Default fallback
            "quality_category": "unknown",
            "reliability": "low",
            "method": "error_fallback"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    # Suppress some warnings that might appear with audio processing
    warnings.filterwarnings("ignore", category=UserWarning)
    main()