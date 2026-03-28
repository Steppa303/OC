#!/bin/bash
# Script to start the RAG API server

cd /root/.openclaw/workspace

# Activate virtual environment
source rag-env/bin/activate

# Install any missing dependencies
pip install fastapi uvicorn

# Start the RAG API server
python rag_api.py