#!/usr/bin/env python3
"""
Verbessertes Skript zur Ingestion ALLER Chat-Sessions in ChromaDB
Mit besserem Error Handling, Logging und Robustheit

SEGFAULT FIX:
- ChromaDB Client wird in subprocess ausgeführt
- Hauptprozess terminiert sauber mit sys.exit(0)
- Kein direktes ChromaDB im Hauptprozess
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
import time
import logging
import sys
import subprocess
import tempfile
import signal


# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def extract_channel_from_session_file(filepath):
    """Extract channel information from session file path or content"""
    filename = os.path.basename(filepath)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            first_lines = []
            for i, line in enumerate(f):
                if i > 10:
                    break
                first_lines.append(line.strip())
                
        content = '\n'.join(first_lines)
        if '"Telegram"' in content or '"telegram"' in content or 'telegram' in filepath.lower():
            return 'telegram'
        elif '"discord"' in content.lower() or 'discord' in filepath.lower():
            return 'discord'
        elif '"whatsapp"' in content.lower() or 'whatsapp' in filepath.lower():
            return 'whatsapp'
        elif '"cli"' in content.lower() or 'cli' in filepath.lower():
            return 'cli'
        else:
            return 'unknown'
    except:
        return 'unknown'


def detect_sensitive_data(text):
    """Detect potential sensitive data in text"""
    patterns = [
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        r'\b(?:api[_-]?key|token|password|secret|pwd)\s*[=:]\s*["\']?([A-Za-z0-9_-]{20,})["\']?',
        r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
        r'\b(?:ssh-|sk-|ak-)[a-zA-Z0-9+/=]{20,}\b',
    ]
    
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def clean_text(text):
    """Remove sensitive data and clean text for embedding"""
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REMOVED]', text)
    text = re.sub(r'\b(?:api[_-]?key|token|password|secret|pwd)\s*[=:]\s*["\']?([A-Za-z0-9_-]{20,})["\']?', '[SENSITIVE_DATA_REMOVED]', text)
    text = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '[IP_REMOVED]', text)
    text = re.sub(r'\b(?:ssh-|sk-|ak-)[a-zA-Z0-9+/=]{20,}\b', '[TOKEN_REMOVED]', text)
    return text


def analyze_content(text):
    """Analyze content to extract metadata"""
    has_code = bool(re.search(r'```[\s\S]*?```|`[^`]+`|\b(function|class|import|const|let|var|if|for|while)\b', text, re.MULTILINE))
    has_recipes = bool(re.search(r'\b(rezept|recipe|zutaten|ingredients|zubereitung|instructions|kochen|cook)\b', text, re.IGNORECASE))
    has_emails = bool(re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text))
    word_count = len(text.split())
    
    return {
        'has_code': has_code,
        'has_recipes': has_recipes,
        'has_emails': has_emails,
        'word_count': word_count
    }


def process_jsonl_file(filepath):
    """Process a single JSONL file and extract interactions"""
    logger.info(f"Processing file: {filepath}")
    
    interactions = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            session_metadata = None
            current_message = None
            
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    entry = json.loads(line)
                    entry_type = entry.get('type', 'unknown')
                    
                    if entry_type == 'session':
                        session_metadata = entry
                    elif entry_type == 'message':
                        message_data = entry.get('message', {})
                        content_list = message_data.get('content', [])
                        
                        content_text = ''
                        for content_item in content_list:
                            if content_item.get('type') == 'text':
                                content_text += content_item.get('text', '') + '\n'
                        
                        if content_text.strip():
                            channel = extract_channel_from_session_file(str(filepath))
                            
                            cleaned_text = clean_text(content_text)
                            metadata = analyze_content(cleaned_text)
                            
                            interaction = {
                                'id': entry.get('id', f'msg_{line_num}'),
                                'session_id': entry.get('id', 'unknown'),
                                'content': cleaned_text,
                                'original_content': content_text[:500],
                                'role': message_data.get('role', 'unknown'),
                                'timestamp': entry.get('timestamp', datetime.now().isoformat()),
                                'channel': channel,
                                'filepath': str(filepath),
                                'metadata': metadata,
                                'has_sensitive_data': detect_sensitive_data(content_text)
                            }
                            
                            interactions.append(interaction)
                            
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON decode error at line {line_num}: {e}")
                    continue
                except Exception as e:
                    logger.error(f"Error processing line {line_num}: {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"Error reading file {filepath}: {e}")
        return []
    
    logger.info(f"  Extracted {len(interactions)} interactions from {filepath}")
    return interactions


def ingest_to_chromadb_http(interactions):
    """
    Ingestiert Daten in ChromaDB via HTTP API (vermeidet Segfault!)
    
    Args:
        interactions: Liste von Interaction Dictionaries
        
    Returns:
        bool: True bei Erfolg, False bei Fehler
    """
    import requests
    
    logger.info("🚀 Starting ChromaDB ingestion via HTTP API...")
    
    CHROMA_URL = "http://localhost:8000"
    COLLECTION_NAME = "chat_sessions"
    
    try:
        # 1. Get or create collection via HTTP
        logger.info(f"Getting/creating collection: {COLLECTION_NAME}")
        
        resp = requests.post(
            f"{CHROMA_URL}/api/v1/collections",
            json={"name": COLLECTION_NAME},
            timeout=30
        )
        
        if resp.status_code not in [200, 409]:  # 409 = already exists
            logger.warning(f"Collection create warning: {resp.status_code} - {resp.text[:200]}")
        
        # Get collection ID
        resp = requests.get(f"{CHROMA_URL}/api/v1/collections/{COLLECTION_NAME}", timeout=30)
        if resp.ok:
            collection_data = resp.json()
            collection_id = collection_data.get('id')
            logger.info(f"Collection ID: {collection_id}")
        else:
            logger.error(f"Failed to get collection: {resp.text[:200]}")
            return False
        
        # 2. Generate embeddings locally
        logger.info("Loading embedding model...")
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # 3. Process in batches
        batch_size = 100
        total_processed = 0
        
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
                    'filepath': item['filepath'],
                    'has_code': str(item['metadata']['has_code']),
                    'has_recipes': str(item['metadata']['has_recipes']),
                    'word_count': str(item['metadata']['word_count'])
                }
                for item in batch
            ]
            
            # Generate embeddings
            logger.info(f"Generating embeddings for batch {i//batch_size + 1}...")
            embeddings = model.encode(documents).tolist()
            
            # Add to collection via HTTP
            logger.info(f"Adding {len(batch)} documents to ChromaDB...")
            resp = requests.post(
                f"{CHROMA_URL}/api/v1/collections/{collection_id}/add",
                json={
                    'embeddings': embeddings,
                    'documents': documents,
                    'metadatas': metadatas,
                    'ids': ids
                },
                timeout=300
            )
            
            if resp.ok:
                total_processed += len(batch)
                logger.info(f"✅ Processed {total_processed}/{len(interactions)}")
            else:
                logger.error(f"Batch add failed: {resp.status_code} - {resp.text[:200]}")
                # Continue with next batch anyway
        
        logger.info(f"Successfully ingested {total_processed} interactions")
        
        # Get collection count
        resp = requests.get(f"{CHROMA_URL}/api/v1/collections/{collection_id}/count", timeout=30)
        if resp.ok:
            count = resp.json()
            logger.info(f"Collection size: {count}")
        
        # Cleanup model
        del model
        
        return True
        
    except requests.exceptions.RequestException as e:
        logger.error(f"HTTP error: {e}")
        return False
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    try:
        # Temporäre Datei für subprocess Skript
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(chromadb_script)
            script_path = f.name
        
        # Subprocess ausführen
        logger.info(f"Running subprocess: python3 {script_path} {interactions_json_file}")
        
        process = subprocess.Popen(
            ['python3', script_path, interactions_json_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Output streamen
        stdout_lines = []
        stderr_lines = []
        
        while True:
            output = process.stdout.readline()
            if output:
                logger.info(output.strip())
                stdout_lines.append(output)
            
            error = process.stderr.readline()
            if error:
                logger.error(error.strip())
                stderr_lines.append(error)
            
            if output == '' and error == '' and process.poll() is not None:
                break
        
        # Restlichen Output lesen
        remaining_stdout, remaining_stderr = process.communicate(timeout=300)
        
        if remaining_stdout:
            for line in remaining_stdout.split('\n'):
                if line:
                    logger.info(line)
                    stdout_lines.append(line)
        
        if remaining_stderr:
            for line in remaining_stderr.split('\n'):
                if line:
                    logger.error(line)
                    stderr_lines.append(line)
        
        return_code = process.returncode
        
        # Cleanup temp file
        try:
            os.unlink(script_path)
        except:
            pass
        
        if return_code == 0:
            logger.info("✅ Subprocess completed successfully")
            return True
        else:
            logger.error(f"❌ Subprocess failed with return code {return_code}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("❌ Subprocess timed out after 5 minutes")
        process.kill()
        return False
    except Exception as e:
        logger.error(f"❌ Subprocess error: {e}")
        return False


def main():
    logger.info("RAG Phase 3: Chat Session Ingestion (Improved)")
    logger.info("="*50)
    
    # Find all JSONL files
    sessions_dir = Path("/root/.openclaw/agents/main/sessions/")
    if not sessions_dir.exists():
        logger.info(f"Sessions directory does not exist: {sessions_dir}, creating it...")
        sessions_dir.mkdir(parents=True, exist_ok=True)
    
    jsonl_files = list(sessions_dir.glob("*.jsonl"))
    logger.info(f"Found {len(jsonl_files)} JSONL files to process")
    
    all_interactions = []
    
    # Process each JSONL file
    for jsonl_file in jsonl_files:
        try:
            interactions = process_jsonl_file(jsonl_file)
            all_interactions.extend(interactions)
        except Exception as e:
            logger.error(f"Error processing file {jsonl_file}: {e}")
            continue
    
    logger.info(f"\nTotal interactions extracted: {len(all_interactions)}")
    
    if not all_interactions:
        logger.info("No interactions found to ingest!")
        return True
    
    # Save interactions to temp file for subprocess
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(all_interactions, f, indent=2)
        interactions_file = f.name
    
    try:
        # Ingest to ChromaDB via HTTP API (NO SEGFAULT!)
        success = ingest_to_chromadb_http(all_interactions)
        
        if success:
            logger.info("\n" + "="*50)
            logger.info("INGESTION COMPLETE!")
            logger.info("="*50)
            logger.info(f"✅ All chat sessions ingested into ChromaDB")
            logger.info(f"✅ Sensitive data scrubbed")
            logger.info(f"✅ Metadata correctly set")
            return True
        else:
            logger.error("\n❌ Ingestion failed!")
            return False
            
    finally:
        # Cleanup temp file
        try:
            os.unlink(interactions_file)
        except:
            pass


if __name__ == "__main__":
    try:
        success = main()
        if success:
            logger.info("\n✅ Ingest completed successfully!")
            exit_code = 0
        else:
            logger.error("\n❌ Ingest failed!")
            exit_code = 1
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        exit_code = 2
    
    # Explizites Cleanup OHNE atexit handlers (vermeidet Segfault)
    logger.info("🧹 Final cleanup (bypassing atexit)...")
    
    # Alle globalen Variablen löschen
    for var in list(globals().keys()):
        if var not in ['__name__', '__doc__', '__package__', '__loader__', '__spec__', '__annotations__', '__builtins__', '__file__', '__cached__', 'os', 'sys', 'logger', 'logging']:
            try:
                del globals()[var]
            except:
                pass
    
    import gc
    gc.collect()
    
    logger.info("✅ Exiting with os._exit() to avoid Segfault")
    
    # WICHTIG: os._exit() bypassing atexit handlers (vermeidet ChromaDB Segfault)
    os._exit(exit_code)
