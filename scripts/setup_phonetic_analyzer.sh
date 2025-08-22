#!/bin/bash

# Setup script for Estonian ASR Analysis Tools
# This script sets up the dependencies needed for phonetic analysis and signal quality assessment

echo "Setting up Estonian ASR Analysis Tools..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Test basic functionality with fallback method
echo "Testing basic phonetic analyzer functionality..."

cd "$(dirname "$0")"

# Test the phonetic analyzer script
python3 phonetic_analyzer.py analyze "protocol" "prototype" > /tmp/phonetic_test.json

if [ $? -eq 0 ]; then
    echo "✓ Basic phonetic analyzer is working"
    cat /tmp/phonetic_test.json | jq '.' 2>/dev/null || cat /tmp/phonetic_test.json
else
    echo "✗ Basic phonetic analyzer test failed"
    exit 1
fi

echo ""
# Test signal quality assessor
echo "Testing signal quality assessor functionality..."

python3 signal_quality_assessor.py assess "/nonexistent/test.mp3" 0 5 > /tmp/signal_test.json

if [ $? -eq 1 ]; then
    echo "✓ Signal quality assessor error handling works"
    cat /tmp/signal_test.json | jq '.' 2>/dev/null || cat /tmp/signal_test.json
else
    echo "✗ Signal quality assessor test unexpected result"
fi

echo ""
echo "🎉 Both phonetic analyzer and signal quality assessor are ready!"
echo ""
echo "For enhanced functionality:"
echo ""
echo "📊 Phonetic Analysis (et-g2p-fst):"
echo "1. Install pynini: pip install pynini"
echo "2. Clone et-g2p-fst: git clone https://github.com/alumae/et-g2p-fst.git"
echo "3. Follow setup instructions in the et-g2p-fst repository"
echo ""
echo "🎛️ Signal Quality Assessment (TorchMetrics):"
echo "1. Install PyTorch: pip install torch torchaudio"
echo "2. Install TorchMetrics: pip install torchmetrics"
echo "3. Install audio tools: pip install librosa numpy"
echo ""
echo "Both tools will automatically detect and use enhanced libraries if available,"
echo "otherwise they will fall back to rule-based methods."