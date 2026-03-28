#!/bin/bash
# ChromaDB Index Cleanup
# Löscht den Index alle 7 Tage (baut sich neu auf)

CHROMA_DIR="/root/.openclaw/chroma_db"
MAX_AGE_DAYS=7

echo "🧹 ChromaDB Index Cleanup..."

# Finde alle link_lists.bin Files die älter als X Tage sind
find "$CHROMA_DIR" -name "link_lists.bin" -mtime +$MAX_AGE_DAYS -exec rm -f {} \;

# Größe anzeigen
INDEX_SIZE=$(du -sh "$CHROMA_DIR" 2>/dev/null | cut -f1)
echo "✅ ChromaDB Index bereinigt! Aktuelle Größe: $INDEX_SIZE"
