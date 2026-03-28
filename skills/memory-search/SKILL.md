---
name: memory-search
description: Semantic memory search using ChromaDB PersistentClient (DIRECT - no HTTP!)
---

# Memory Search Skill - DIRECT PERSISTENTCLIENT

## ⚠️ WICHTIG: Kein HTTP, Kein Server!

Dieses Skill verwendet **DIRECTEN Zugriff** auf ChromaDB SQLite:
- ✅ `/root/.openclaw/chroma_db/`
- ✅ `chromadb.PersistentClient()`
- ❌ KEIN `localhost:8000`
- ❌ KEIN `chroma run` Server

---

## 🛠️ IMPLEMENTATION

### Python Script für memory_search

```python
#!/usr/bin/env python3
"""
Memory Search - DIRECT PERSISTENTCLIENT
Kein HTTP, kein Server - direkter Zugriff auf ChromaDB SQLite!
"""

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import json
import sys
import os


def memory_search(query, max_results=5, min_score=0.0):
    """
    Semantic search in ChromaDB memory
    
    Args:
        query: Search query string
        max_results: Maximum number of results (default: 5)
        min_score: Minimum similarity score (default: 0.0)
    
    Returns:
        dict: Search results or error message
    """
    try:
        # DIRECT Zugriff auf SQLite DB!
        client = chromadb.PersistentClient(
            path='/root/.openclaw/chroma_db/',
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get collection
        try:
            collection = client.get_collection(name='chat_sessions')
        except Exception as e:
            return {
                'error': f'Collection not found: {e}',
                'results': [],
                'provider': 'none',
                'mode': 'collection-missing'
            }
        
        # Load embedding model
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Generate query embedding
        query_embedding = model.encode([query]).tolist()
        
        # Query collection
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=max_results,
            include=['documents', 'metadatas', 'distances']
        )
        
        # Format results
        formatted_results = []
        if results and results.get('documents'):
            for i, doc in enumerate(results['documents'][0]):
                distance = results['distances'][0][i] if results.get('distances') else 0
                metadata = results['metadatas'][0][i] if results.get('metadatas') else {}
                
                # Convert distance to similarity score (cosine distance)
                similarity = 1 - distance
                
                if similarity >= min_score:
                    formatted_results.append({
                        'content': doc,
                        'metadata': metadata,
                        'score': similarity,
                        'distance': distance
                    })
        
        # Cleanup BEFORE exit
        del collection
        del client
        del model
        
        import gc
        gc.collect()
        
        return {
            'results': formatted_results,
            'provider': 'chromadb',
            'mode': 'direct',
            'query': query,
            'count': len(formatted_results)
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        
        return {
            'error': str(e),
            'error_details': error_details,
            'results': [],
            'provider': 'error',
            'mode': 'failed'
        }


def memory_get(path, from_line=None, lines=None):
    """
    Read specific lines from memory file
    
    Args:
        path: File path
        from_line: Start line number
        lines: Number of lines to read
    
    Returns:
        dict: File content or error
    """
    try:
        with open(path, 'r', encoding='utf-8') as f:
            all_lines = f.readlines()
        
        if from_line:
            start = max(0, from_line - 1)
            end = start + lines if lines else len(all_lines)
            selected_lines = all_lines[start:end]
        else:
            selected_lines = all_lines[:lines] if lines else all_lines
        
        return {
            'content': ''.join(selected_lines),
            'path': path,
            'lines_read': len(selected_lines),
            'total_lines': len(all_lines)
        }
        
    except Exception as e:
        return {
            'error': str(e),
            'path': path
        }


if __name__ == '__main__':
    # CLI interface for testing
    if len(sys.argv) < 2:
        print("Usage: python memory_search.py <query> [max_results] [min_score]")
        sys.exit(1)
    
    query = sys.argv[1]
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    min_score = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    
    result = memory_search(query, max_results, min_score)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Clean exit
    import os
    os._exit(0)

```

---

## 🔧 INSTALLATION

```bash
# Skill Verzeichnis erstellen
mkdir -p /root/.openclaw/workspace/skills/memory-search

# Skill Datei erstellen (siehe oben)

# Dependencies installieren
pip install chromadb sentence-transformers

# Testen
python3 /root/.openclaw/workspace/skills/memory-search/test.py "Dashboard Bug Fix"
```

---

## ✅ ERROR HANDLING

### Massive Error-Handling:

```python
try:
    # ChromaDB Zugriff
    client = chromadb.PersistentClient(path='/root/.openclaw/chroma_db/')
    
except chromadb.db.base.Error as e:
    return {'error': f'ChromaDB Error: {e}', 'results': []}
    
except FileNotFoundError as e:
    return {'error': f'DB not found: {e}', 'results': []}
    
except Exception as e:
    import traceback
    return {
        'error': str(e),
        'error_details': traceback.format_exc(),
        'results': []
    }
```

---

## 🧪 TESTING

### Test 1: Collection.get() vs query()

```python
# ❌ collection.get() crasht manchmal
# collection.get(where={'session_id': 'test'})

# ✅ collection.query() ist stabiler
results = collection.query(
    query_embeddings=embedding,
    n_results=5,
    include=['documents', 'metadatas']
)
```

### Test 2: Dummy Query

```bash
python3 /root/.openclaw/workspace/skills/memory-search/test.py "test" 1
```

---

## 📊 EXPECTED OUTPUT

```json
{
  "results": [
    {
      "content": "Agent Dashboard Bug Fix...",
      "metadata": {
        "session_id": "e0137367",
        "channel": "telegram",
        "timestamp": "2026-03-28T..."
      },
      "score": 0.85,
      "distance": 0.15
    }
  ],
  "provider": "chromadb",
  "mode": "direct",
  "query": "Dashboard Bug Fix",
  "count": 1
}
```

---

## ❌ ERROR OUTPUT

```json
{
  "error": "Collection not found: chat_sessions",
  "error_details": "chromadb.errors.NotFoundError...",
  "results": [],
  "provider": "error",
  "mode": "collection-missing"
}
```

---

## 🔥 CLEANUP

**WICHTIG:** Vor `os._exit()` aufräumen!

```python
# Cleanup BEFORE exit
del collection
del client
del model

import gc
gc.collect()

# Clean exit (vermeidet Segfault!)
os._exit(0)
```

---

## 📝 NOTES

1. **Kein HTTP** - Direkter SQLite Zugriff
2. **os._exit()** - Vermeidet Segfault beim Exit
3. **collection.query()** - Stabiler als collection.get()
4. **Massive Error-Handling** - Jede Exception fangen
5. **Cleanup** - Alle Objekte löschen vor Exit
