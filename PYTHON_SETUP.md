# Python Environment Setup for EST-ASR Analysis Tools

This document explains how to set up the Python environment for advanced transcript analysis features, including signal quality assessment and phonetic analysis tools.

## Overview

The EST-ASR UI includes several Python-based analysis tools:

- **SignalQualityAssessor**: Uses PyTorch and TorchMetrics for SNR calculation and audio quality analysis
- **PhoneticAnalyzer**: Uses Estonian G2P (grapheme-to-phoneme) conversion for phonetic similarity analysis

These tools are designed to work with fallback methods but provide enhanced functionality when proper dependencies are installed.

## Quick Setup (Docker - Recommended)

The easiest way to get all dependencies working is using Docker:

```bash
# 1. Build and start the Python environment
npm run python:setup

# 2. Verify it's working
npm run python:status

# 3. Test the tools (optional)
npm run python:shell
# Inside container: python /app/scripts/signal_quality_assessor.py assess "/nonexistent/test.wav" 0 1
```

## Manual Setup (System Python)

If you prefer not to use Docker, you can install dependencies system-wide:

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Core Dependencies
```bash
# For signal quality assessment
pip install torch torchaudio torchmetrics librosa numpy scipy

# For phonetic analysis (optional)
pip install pynini openfst-python
```

### Verification
```bash
# Test basic functionality
python3 scripts/signal_quality_assessor.py assess "/nonexistent/test.wav" 0 1

# Should return JSON with error but no import warnings
```

## Docker Environment Details

### Container Specifications
- **Base Image**: `python:3.11-slim`
- **Dependencies**: PyTorch 2.1.0, TorchMetrics 1.2.0, librosa 0.10.1, numpy 1.24.3
- **Audio Support**: libsndfile, ffmpeg, sox
- **Container Name**: `est-asr-python-tools`

### Available Commands
```bash
# Container management
npm run python:build    # Build the Docker image
npm run python:up       # Start container in background
npm run python:down     # Stop and remove container
npm run python:logs     # View container logs
npm run python:shell    # Access container bash shell
npm run python:status   # Check container status

# Combined setup
npm run python:setup    # Build + start (recommended)
```

### Volume Mounts
- `./scripts:/app/scripts:ro` - Scripts are mounted read-only
- `/tmp:/tmp` - Temporary directory for file processing

## How It Works

### Automatic Detection
The SignalQualityAssessor tool automatically detects the best available Python environment:

1. **First**: Tries Docker container with full dependencies
2. **Fallback**: Uses system Python with available packages
3. **Last Resort**: Basic analysis using standard library only

### Environment Priority
```
Docker (enhanced) → System Python (enhanced) → System Python (fallback) → Error state
```

### Logging
The tool logs which environment it's using:
```
SignalQualityAssessor: Executing quality assessment command (Docker)
```
or
```
SignalQualityAssessor: Executing quality assessment command (System Python)
```

## Troubleshooting

### Docker Issues
```bash
# Container not starting
docker compose -f docker-compose.python.yml logs

# Rebuild from scratch
docker compose -f docker-compose.python.yml down
docker compose -f docker-compose.python.yml build --no-cache
docker compose -f docker-compose.python.yml up -d
```

### System Python Issues
```bash
# Check Python version
python3 --version

# Test imports manually
python3 -c "import torch; print('PyTorch OK')"
python3 -c "import torchmetrics; print('TorchMetrics OK')"
python3 -c "import librosa; print('librosa OK')"
```

### Performance Considerations
- Docker environment: Full functionality, consistent results
- System Python: May vary based on installed packages
- Fallback mode: Basic functionality only, faster but less accurate

## Development

### Testing Changes
If you modify the Python scripts:

1. **With Docker**: Changes are automatically available (scripts are mounted)
2. **System Python**: Changes are immediately available

### Adding Dependencies
To add new Python dependencies:

1. Update `docker/python-tools/requirements.txt`
2. Update `docker/python-tools/Dockerfile`
3. Rebuild: `npm run python:build`
4. Restart: `npm run python:up`

### Custom Python Command
You can override the Python command or script path:

```typescript
// In your TypeScript code
const tool = new SignalQualityAssessorTool('python3.11', '/custom/path/to/script.py');
```

The tool will still prefer Docker if available, but will use your custom settings for fallback.

## Production Deployment

### Docker Production
The Docker setup is production-ready. Ensure:
- Docker and docker-compose are installed
- Run `npm run python:setup` after deployment
- Monitor with `npm run python:logs`

### System Python Production
For production without Docker:
- Install dependencies with specific versions (see requirements.txt)
- Test thoroughly with your audio files
- Monitor for import warnings in logs

## Support

If you encounter issues:
1. Check the container logs: `npm run python:logs`
2. Verify container status: `npm run python:status`
3. Test in container shell: `npm run python:shell`
4. Fall back to system Python if needed

The system is designed to gracefully degrade, so basic functionality should always work even if enhanced features are unavailable.