# RAG Phase 3: NEXT STEPS

## 📌 Status: PHASE 2 ABGESCHLOSSEN ✅

###失望s章节 2: Dokumente Ingestiert
- ✅ 9 Rezepte (PDFs + Markdown)
- ✅ 5 Dokumentationsdateien
- ✅ 2 Memory-Files
- ✅ **Insgesamt: 16 Dokumente**
- ✅ Metadata korrekt gesetzt (source, type, created_at, word_count)
- ✅ Suchqueries erfolgreich getestet

---

## 🚀 Phase 3: API-Endpunkte & Integration

### Ziel
API-Endpunkte erstellen, um die ChromaDB-Collection über HTTP abzufragen und zu managen.

### Tasks

#### 1. FastAPI-Server erstellen
```
/root/.openclaw/workspace/rag_api.py
```

**Endpunkte:**
- `GET /api/status` - Systemstatus
- `GET /api/collections` - Alle Collections auflisten
- `POST /api/ingest` - Neue Dokumente ingestieren
- `POST /api/search` - Semantische Suche durchführen
- `GET /api/documents` - Alle Dokumente mit Metadata
- `DELETE /api/documents/{id}` - Dokument löschen

#### 2. Request/Response Models definieren
```python
class SearchRequest(BaseModel):
    query: str
    n_results: int = 5

class SearchResponse(BaseModel):
    results: List[Dict]
    query_time_ms: float

class IngestRequest(BaseModel):
    documents: List[str]
    metadatas: List[Dict]
    ids: List[str]

class CollectionInfo(BaseModel):
    name: str
    count: int
    metadata: Dict
```

#### 3. Start-Script erstellen
```
/root/.openclaw/workspace/start_rag_api.sh
```

#### 4. Konfiguration
```python
# /root/.openclaw/workspace/rag_config.json
{
    "chromadb_path": "/root/.openclaw/workspace/rag-db",
    "host": "0.0.0.0",
    "port": 8000,
    "embedding_model": "all-MiniLM-L6-v2",
    "default_n_results": 5,
    "max_n_results": 20
}
```

---

## 📊 Priorisierung

### Priority 1 (Sofort)
- [ ] FastAPI-Server mit allen Endpunkten
- [ ] Start-Script erstellen
- [ ] Einfache Test-Clients

### Priority 2 (Nächste Woche)
- [ ] Caching-Layer für embeddings
- [ ] Query-Verbesserungen (Hybrid Search?)
- [ ] Monitoring & Logging

### Priority 3 (Später)
- [ ] Authentifizierung (optional)
- [ ] Web-Frontend für Suche
- [ ] Integration mit Agenten-System

---

## 🧪 Test-Plan

### Manuelle Tests
```bash
# Start the API
./start_rag_api.sh

# Status check
curl http://localhost:8000/api/status

# Search
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Avocado Rezepte", "n_results": 3}'

# Ingest
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": ["Test document"],
    "metadatas": [{"source": "test", "type": "doku"}],
    "ids": ["test-1"]
  }'
```

### Automatische Tests
```bash
# Run test suite
python3 test_rag_api.py
```

---

## 📝 Notes

- ChromaDB persistent mode am laufen halten
- Embeddings lokal berechnen (keine API keys nötig)
- Performance: Ziel <100ms response time
- Speicher: ChromaDB nutzt-local storage

---

**Status:** Phase 3 in Vorbereitung
