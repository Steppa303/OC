#!/usr/bin/env python3
"""
Memory Search - SUBPROCESS WRAPPER
Isoliert ChromaDB in subprocess um Segfaults zu vermeiden
"""

import subprocess
import json
import sys
import os

CHROMA_DB_PATH = '/root/.openclaw/chroma_db/'

def memory_search(query, max_results=5, min_score=0.0):
    """
    Semantic search via subprocess (isoliert ChromaDB!)
    """
    
    # Python Code für subprocess
    python_code = f'''
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import json
import os

try:
    client = chromadb.PersistentClient(
        path='{CHROMA_DB_PATH}',
        settings=Settings(anonymized_telemetry=False)
    )
    
    collection = client.get_collection(name='chat_sessions')
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    query_embedding = model.encode(["{query}"]).tolist()
    
    results = collection.query(
        query_embeddings=query_embedding,
        n_results={max_results},
        include=['documents', 'metadatas', 'distances']
    )
    
    formatted = []
    if results and results.get('documents'):
        for i, doc in enumerate(results['documents'][0]):
            distance = results['distances'][0][i] if results.get('distances') else 0
            metadata = results['metadatas'][0][i] if results.get('metadatas') else {{}}
            similarity = 1 - distance
            if similarity >= {min_score}:
                formatted.append({{
                    'content': doc,
                    'metadata': metadata,
                    'score': similarity,
                    'distance': distance
                }})
    
    del collection, client, model
    import gc; gc.collect()
    
    print(json.dumps({{'results': formatted, 'provider': 'chromadb', 'mode': 'direct', 'count': len(formatted)}}))
    
except Exception as e:
    import traceback
    print(json.dumps({{'error': str(e), 'error_details': traceback.format_exc(), 'results': [], 'provider': 'error'}}))

os._exit(0)
'''
    
    try:
        result = subprocess.run(
            ['python3', '-c', python_code],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            return {'error': f'Process failed: {result.stderr}', 'results': []}
            
    except subprocess.TimeoutExpired:
        return {'error': 'Timeout after 60s', 'results': []}
    except json.JSONDecodeError as e:
        return {'error': f'JSON parse error: {e}', 'results': []}
    except Exception as e:
        return {'error': str(e), 'results': []}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python memory_search.py <query> [max_results]")
        sys.exit(1)
    
    query = sys.argv[1]
    max_results = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    result = memory_search(query, max_results)
    print(json.dumps(result, indent=2, ensure_ascii=False))
