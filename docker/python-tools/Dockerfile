# Python Tools Dockerfile for EST-ASR Analysis
# This container provides a consistent Python environment with all dependencies
# for signal quality assessment and phonetic analysis tools

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libsndfile1-dev \
    ffmpeg \
    sox \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Using specific versions for reproducibility
RUN pip install --no-cache-dir \
    torch==2.1.0 \
    torchaudio==2.1.0 \
    torchmetrics==1.2.0 \
    librosa==0.10.1 \
    numpy==1.24.3 \
    scipy==1.11.3 \
    soundfile==0.12.1 \
    pynini==2.1.5 \
    openfst-python==1.8.2

# Create scripts directory
RUN mkdir -p /app/scripts

# Copy requirements for reference
COPY requirements.txt /app/requirements.txt

# Set Python path
ENV PYTHONPATH=/app/scripts:$PYTHONPATH

# Keep container running
CMD ["tail", "-f", "/dev/null"]