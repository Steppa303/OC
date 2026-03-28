#!/bin/bash
# ChromaDB Size Monitor
# Prüft alle 3 Stunden die ChromaDB Größe
# Warnt wenn >100GB

CHROMA_DIR="/root/.openclaw/chroma_db"
MAX_SIZE_GB=100
LOG_FILE="/tmp/chromadb-monitor.log"
ALERT_FILE="/tmp/chromadb-alert.txt"

echo "[$(date)] ChromaDB Size Monitor..." >> "$LOG_FILE"

# Größe in GB holen
SIZE_BYTES=$(du -sb "$CHROMA_DIR" 2>/dev/null | cut -f1)
SIZE_GB=$((SIZE_BYTES / 1024 / 1024 / 1024))

echo "[$(date)] Aktuelle Größe: ${SIZE_GB}GB" >> "$LOG_FILE"

# Prüfen ob >100GB
if [ "$SIZE_GB" -gt "$MAX_SIZE_GB" ]; then
    echo "⚠️ ALERT: ChromaDB ist ${SIZE_GB}GB (Limit: ${MAX_SIZE_GB}GB)!" >> "$LOG_FILE"
    
    # Alert-Datei erstellen (wird bei nächster Session gelesen)
    echo "🚨 CHROMADB ALERT 🚨" > "$ALERT_FILE"
    echo "Zeit: $(date)" >> "$ALERT_FILE"
    echo "Größe: ${SIZE_GB}GB" >> "$ALERT_FILE"
    echo "Limit: ${MAX_SIZE_GB}GB" >> "$ALERT_FILE"
    echo "" >> "$ALERT_FILE"
    echo "Bitte prüfen und ggf. cleanupen:" >> "$ALERT_FILE"
    echo "rm -rf /root/.openclaw/chroma_db/*/link_lists.bin" >> "$ALERT_FILE"
    
    echo "[$(date)] ALERT erstellt!" >> "$LOG_FILE"
else
    # Alert-Datei löschen wenn wieder im Limit
    rm -f "$ALERT_FILE" 2>/dev/null
    echo "[$(date)] OK (${SIZE_GB}GB < ${MAX_SIZE_GB}GB)" >> "$LOG_FILE"
fi

echo "---" >> "$LOG_FILE"
