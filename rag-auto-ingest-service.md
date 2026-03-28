# RAG Auto-Ingest Service

## Beschreibung
Der RAG Auto-Ingest Service überwacht automatisch neue Chat-Sessions und Agent-Aktivitäten und ingested diese in die ChromaDB für die spätere RAG (Retrieval Augmented Generation) Nutzung.

## Funktionen
- Überwacht alle 5 Minuten neue Session-Dateien
- Ingestet Chat-Verläufe in die `chat_sessions` Collection
- Ingestet Agent-Daten in die `agent_logs` Collection
- Robuste Fehlerbehandlung mit Retry-Logik
- Vollständiges Logging (Status und Fehler)
- Inkrementelle Verarbeitung (keine Duplikate)

## Installation/Setup
Alle Skripte befinden sich im Verzeichnis `/root/.openclaw/workspace/`:
- `start-auto-ingest-service.mjs` - Hauptstartskript
- `setup-auto-ingest-service.mjs` - Setup-Skript
- `lib/rag-auto-ingest-improved.mjs` - Hauptmodul
- `lib/ingest_agents.py` - Agent-Ingestion
- `lib/ingest_single_session.py` - Session-Ingestion
- `ingest_chat_sessions.py` - Chat-Ingestion

## Service-Management
- Status: `systemctl status rag-auto-ingest.service`
- Start: `systemctl start rag-auto-ingest.service`
- Stop: `systemctl stop rag-auto-ingest.service`
- Neustart: `systemctl restart rag-auto-ingest.service`

## Logs
- Status: `/root/.openclaw/chroma_db/auto_ingest_status.log`
- Fehler: `/root/.openclaw/chroma_db/auto_ingest_errors.log`
- Metadaten: `/root/.openclaw/chroma_db/auto_ingest_metadata.json`

## Abhängigkeiten
- Python 3.12
- chromadb
- sentence-transformers
- Node.js

## Collections
- `chat_sessions`: Chat-Verläufe mit Metadaten
- `agent_logs`: Agent-Aktivitäten und Metriken