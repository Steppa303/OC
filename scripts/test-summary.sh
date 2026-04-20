#!/bin/bash
rm /root/.openclaw/workspace/memory/.summary-state
python3 /root/.openclaw/workspace/scripts/generate-session-summaries.py
