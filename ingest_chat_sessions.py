#!/usr/bin/env python3
"""
Chat Session Ingestion - DIRECT PERSISTENTCLIENT
Kein HTTP, kein Server - direkter Zugriff auf ChromaDB SQLite!
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
import logging
import sys


# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def extract_channel_from_session_file(filepath):
    """Extract channel information from session file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read(2000)
        
        if '"Telegram"' in content or '"telegram"' in content:
            return 'telegram'
        elif '"discord"' in content.lower():
            return 'discord'
        elif '"whatsapp"' in content.lower():
            return 'whatsapp'
        else:
            return 'cli'
    except:
        return 'cli'


def clean_text(text):
    """Remove sensitive data"""
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REMOVED]', text)
    text = re.sub(r'\b(?:api[_-]?key|token|password|secret|pwd)\s*[=:]\s*["\']?([A-Za-z0-9_-]{20,})["\']?', '[SENSITIVE_REMOVED]', text)
    return text


def analyze_content(text):
    """Analyze content for metadata"""
    return {
        'has_code': bool(re.search(r'```|`[^`]+`|\b(function|class|import|const)\b', text)),
        'has_recipes': bool(re.search(r'\b(rezept|recipe|zutaten|kochen)\b', text, re.IGNORECASE)),
        'word_count': len(text.split())
    }


def process_jsonl_file(filepath):
    """Process JSONL file and extract interactions"""
    logger.info(f"Processing: {filepath}")
    interactions = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    entry = json.loads(line)
                    
                    if entry.get('type') == 'message':
                        message_data = entry.get('message', {})
                        content_list = message_data.get('content', [])
                        
                        content_text = ''
                        for item in content_list:
                            if item.get('type') == 'text':
                                content_text += item.get('text', '') + '\n'
                        
                        if content_text.strip():
                            cleaned = clean_text(content_text)
                            
                            interaction = {
                                'id': entry.get('id', f'msg_{line_num}'),
                                'session_id': Path(filepath).stem,
                                'content': cleaned,
                                'role': message_data.get('role', 'unknown'),
                                'timestamp': entry.get('timestamp', datetime.now().isoformat()),
                                'channel': extract_channel_from_session_file(filepath),
                                'filepath': str(filepath),
                                'metadata': analyze_content(cleaned)
                            }
                            
                            interactions.append(interaction)
                            
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.warning(f"Error line {line_num}: {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"Error reading {filepath}: {e}")
        return []
    
    logger.info(f"  ✅ Extracted {len(interactions)} interactions")
    return interactions


def ingest_to_chromadb_direct(interactions):
    """
    DIRECT PERSISTENTCLIENT - Kein HTTP, kein Server!
    """
    logger.info("🚀 Starting DIRECT ChromaDB ingestion...")
    
    try:
        # DIRECT Zugriff auf SQLite DB!
        import chromadb
        from chromadb.config import Settings
        
        logger.info("Initializing PersistentClient...")
        client = chromadb.PersistentClient(
            path='/root/.openclaw/chroma_db/',
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        logger.info("Getting/creating collection: chat_sessions")
        collection = client.get_or_create_collection(
            name='chat_sessions',
            metadata={"description": "Chat sessions from OpenClaw"}
        )
        
        # Load embedding model
        logger.info("Loading embedding model: all-MiniLM-L6-v2")
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Process in batches
        batch_size = 100
        total_processed = 0
        total_added = 0
        
        logger.info(f"Processing {len(interactions)} interactions in batches of {batch_size}")
        
        for i in range(0, len(interactions), batch_size):
            batch = interactions[i:i+batch_size]
            
            documents = [item['content'] for item in batch]
            ids = [f"{item['session_id']}_{item['id']}" for item in batch]
            metadatas = [
                {
                    'session_id': item['session_id'],
                    'channel': item['channel'],
                    'timestamp': item['timestamp'],
                    'role': item['role'],
                    'has_code': str(item['metadata']['has_code']),
                    'has_recipes': str(item['metadata']['has_recipes']),
                    'word_count': str(item['metadata']['word_count'])
                }
                for item in batch
            ]
            
            # Generate embeddings
            logger.info(f"Batch {i//batch_size + 1}: Generating embeddings...")
            embeddings = model.encode(documents).tolist()
            
            # Add to collection
            logger.info(f"Batch {i//batch_size + 1}: Adding {len(batch)} documents...")
            
            try:
                collection.add(
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                total_added += len(batch)
                logger.info(f"  ✅ Added {total_added}/{len(interactions)}")
            except Exception as add_error:
                logger.warning(f"Batch add error (may be duplicates): {add_error}")
                total_processed += len(batch)
                continue
            
            total_processed += len(batch)
        
        # Final count
        final_count = collection.count()
        logger.info(f"\n✅ SUCCESS!")
        logger.info(f"   Processed: {total_processed} interactions")
        logger.info(f"   Added: {total_added} documents")
        logger.info(f"   Collection size: {final_count} documents")
        
        # Cleanup BEFORE exit
        logger.info("🧹 Cleaning up...")
        del collection
        del client
        del model
        
        import gc
        gc.collect()
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    logger.info("="*60)
    logger.info("RAG Phase 3: Chat Session Ingestion (DIRECT)")
    logger.info("="*60)
    
    # Find all JSONL files
    sessions_dir = Path("/root/.openclaw/agents/main/sessions/")
    if not sessions_dir.exists():
        logger.error(f"Sessions directory not found: {sessions_dir}")
        return False
    
    jsonl_files = list(sessions_dir.glob("*.jsonl"))
    logger.info(f"Found {len(jsonl_files)} JSONL files")
    
    # Process all files
    all_interactions = []
    for jsonl_file in jsonl_files:
        interactions = process_jsonl_file(jsonl_file)
        all_interactions.extend(interactions)
    
    logger.info(f"\n📊 Total interactions: {len(all_interactions)}")
    
    if not all_interactions:
        logger.info("No interactions to ingest!")
        return True
    
    # Ingest to ChromaDB (DIRECT!)
    success = ingest_to_chromadb_direct(all_interactions)
    
    if success:
        logger.info("\n" + "="*60)
        logger.info("✅ INGESTION COMPLETE!")
        logger.info("="*60)
        return True
    else:
        logger.error("\n❌ Ingestion failed!")
        return False


if __name__ == "__main__":
    _exit_code = 0
    
    try:
        success = main()
        _exit_code = 0 if success else 1
    except Exception as e:
        logger.error(f"❌ Fatal: {e}")
        _exit_code = 2
    
    # Cleanup
    logger.info("🧹 Final cleanup...")
    for var in list(globals().keys()):
        if var not in ['__name__', '__doc__', '__builtins__', 'os', 'sys', 'logger', 'logging', '_exit_code']:
            try:
                del globals()[var]
            except:
                pass
    
    import gc
    gc.collect()
    
    logger.info("✅ Exiting...")
    
    # WICHTIG: os._exit() bypasses atexit (vermeidet Segfault!)
    os._exit(_exit_code)
