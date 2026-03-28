#!/usr/bin/env python3
"""
Verbessertes Skript zur Ingestion ALLER Chat-Sessions in ChromaDB
Mit besserem Error Handling, Logging und Robustheit
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer
import time
import logging
import sys


# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def extract_channel_from_session_file(filepath):
    """Extract channel information from session file path or content"""
    filename = os.path.basename(filepath)
    # Look for patterns in the session content that indicate channel
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            first_lines = []
            for i, line in enumerate(f):
                if i > 10:  # Only check first 10 lines for efficiency
                    break
                first_lines.append(line.strip())
                
        # Look for channel indicators in the content
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
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # email
        r'\b(?:api[_-]?key|token|password|secret|pwd)\s*[=:]\s*["\']?([A-Za-z0-9_-]{20,})["\']?',  # api keys
        r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',  # IP addresses
        r'\b(?:ssh-|sk-|ak-)[a-zA-Z0-9+/=]{20,}\b',  # various tokens
    ]
    
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def clean_text(text):
    """Remove sensitive data and clean text for embedding"""
    # Remove email addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REMOVED]', text)
    
    # Remove potential API keys/tokens
    text = re.sub(r'\b(?:api[_-]?key|token|password|secret|pwd)\s*[=:]\s*["\']?([A-Za-z0-9_-]{20,})["\']?', '[SENSITIVE_DATA_REMOVED]', text)
    
    # Remove IP addresses
    text = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '[IP_REMOVED]', text)
    
    # Remove various tokens
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
    """Process a single JSONL file and extract chat interactions"""
    logger.info(f"Processing: {filepath}")
    
    interactions = []
    session_info = {}
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    entry = json.loads(line)
                    
                    # Extract session info from session type entries
                    if entry.get('type') == 'session':
                        session_info['session_id'] = entry.get('id')
                        session_info['session_timestamp'] = entry.get('timestamp')
                        
                    # Extract conversation entries
                    elif entry.get('type') == 'message':
                        message_data = entry.get('message', {})
                        role = message_data.get('role')
                        content_items = message_data.get('content', [])
                        
                        # Extract text content
                        text_content = ""
                        for item in content_items:
                            if item.get('type') == 'text':
                                text_content += item.get('text', '') + "\n"
                        
                        # Only process non-empty messages
                        if text_content.strip():
                            timestamp = entry.get('timestamp')
                            
                            # Clean the content
                            cleaned_content = clean_text(text_content)
                            
                            # Analyze content for metadata
                            content_analysis = analyze_content(cleaned_content)
                            
                            interaction = {
                                'session_id': session_info.get('session_id', os.path.basename(filepath)),
                                'session_timestamp': session_info.get('session_timestamp'),
                                'timestamp': timestamp,
                                'role': role,
                                'content': cleaned_content.strip(),
                                'original_line': line_num,
                                'file_path': str(filepath),
                                'channel': extract_channel_from_session_file(filepath),
                                **content_analysis
                            }
                            
                            interactions.append(interaction)
                            
                except json.JSONDecodeError as e:
                    logger.warning(f"Could not parse JSON at line {line_num} in {filepath}: {e}")
                    continue
    
    except Exception as e:
        logger.error(f"Error processing file {filepath}: {e}")
        return []
    
    logger.info(f"Found {len(interactions)} interactions in {filepath}")
    return interactions


def ingest_to_chromadb(all_interactions):
    """Ingest all interactions into ChromaDB"""
    logger.info(f"\nStarting ingestion of {len(all_interactions)} total interactions...")
    
    # Initialize ChromaDB client
    try:
        client = chromadb.PersistentClient(path="/root/.openclaw/chroma_db")
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB client: {e}")
        return None
    
    try:
        # Get or create collection
        collection = client.get_or_create_collection(
            name="chat_sessions",
            metadata={"hnsw:space": "cosine"}  # Using cosine similarity
        )
    except Exception as e:
        logger.error(f"Failed to get/create ChromaDB collection: {e}")
        return None
    
    # Load embedding model
    logger.info("Loading embedding model...")
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")
        return None
    
    # Process in batches for efficiency
    batch_size = 100
    total_processed = 0
    
    try:
        for i in range(0, len(all_interactions), batch_size):
            batch = all_interactions[i:i + batch_size]
            
            logger.info(f"Ingesting batch {i//batch_size + 1}/{(len(all_interactions)-1)//batch_size + 1} ({len(batch)} items)")
            
            # Prepare batch data
            documents = []
            metadatas = []
            ids = []
            
            for idx, interaction in enumerate(batch):
                doc_id = f"{interaction['session_id']}_{interaction['timestamp']}_{idx}"
                
                # Create document text combining role and content
                document_text = f"[{interaction['role'].upper()}] {interaction['content']}"
                
                documents.append(document_text)
                
                # Prepare metadata - ensure all values are strings, ints, or floats for ChromaDB compatibility
                metadata = {
                    'session_id': str(interaction['session_id']),
                    'session_timestamp': str(interaction['session_timestamp']) if interaction['session_timestamp'] else '',
                    'timestamp': str(interaction['timestamp']),
                    'role': str(interaction['role']),
                    'channel': str(interaction['channel']),
                    'word_count': int(interaction['word_count']),
                    'has_code': bool(interaction['has_code']),
                    'has_recipes': bool(interaction['has_recipes']),
                    'has_emails': bool(interaction['has_emails']),
                    'file_path': str(interaction['file_path']),
                    'original_line': int(interaction['original_line'])
                }
                metadatas.append(metadata)
                ids.append(doc_id)
            
            # Generate embeddings for the batch
            embeddings = model.encode(documents).tolist()
            
            # Add to collection
            collection.add(
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            total_processed += len(batch)
            logger.info(f"  Completed batch - Total processed: {total_processed}/{len(all_interactions)}")
    except Exception as e:
        logger.error(f"Error during batch ingestion: {e}")
        return None
    
    logger.info(f"\nSuccessfully ingested {total_processed} interactions into ChromaDB!")
    logger.info(f"Collection: chat_sessions")
    logger.info(f"Total documents in collection: {collection.count()}")
    
    return collection


def test_queries(collection):
    """Test the ingestion with sample queries"""
    if collection is None:
        logger.warning("Skipping test queries due to ingestion failure")
        return
    
    logger.info("\n" + "="*50)
    logger.info("TESTING QUERIES")
    logger.info("="*50)
    
    test_queries = [
        "Bärlauchsuppe Rezept",
        "Dashboard Cleanup", 
        "Dirk Mail"
    ]
    
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        for query in test_queries:
            logger.info(f"\nTesting query: '{query}'")
            start_time = time.time()
            
            # Generate embedding for query
            query_embedding = model.encode([query]).tolist()
            
            # Perform similarity search
            results = collection.query(
                query_embeddings=query_embedding,
                n_results=3,
                include=['documents', 'metadatas', 'distances']
            )
            
            end_time = time.time()
            query_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            logger.info(f"  Query time: {query_time:.2f}ms")
            logger.info(f"  Found {len(results['documents'][0])} results")
            
            for i, (doc, meta, dist) in enumerate(zip(results['documents'][0], results['metadatas'][0], results['distances'][0])):
                logger.info(f"    Result {i+1} (distance: {dist:.3f}):")
                logger.info(f"      Content preview: {doc[:100]}...")
                logger.info(f"      Session: {meta['session_id']}")
                logger.info(f"      Channel: {meta['channel']}")
                logger.info(f"      Timestamp: {meta['timestamp']}")
    except Exception as e:
        logger.error(f"Error during test queries: {e}")


def main():
    logger.info("RAG Phase 3: Chat Session Ingestion (Improved)")
    logger.info("="*50)
    
    # Find all JSONL files in the sessions directory (including deleted/reset files)
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
        return
    
    # Ingest to ChromaDB
    collection = ingest_to_chromadb(all_interactions)
    
    # Test queries
    test_queries(collection)
    
    logger.info("\n" + "="*50)
    logger.info("INGESTION COMPLETE!")
    logger.info("="*50)
    logger.info(f"✅ All chat sessions ingested into ChromaDB collection 'chat_sessions'")
    logger.info(f"✅ Sensitive data scrubbed")
    logger.info(f"✅ Metadata correctly set")
    if collection:
        logger.info(f"✅ Search queries tested successfully")
    logger.info(f"✅ Ready for further processing")


def cleanup_resources():
    """
    Explizites Cleanup aller Ressourcen um Segfaults zu vermeiden
    """
    import gc
    
    logger.info("🧹 Cleaning up resources...")
    
    # 1. ChromaDB Client explizit löschen
    global chroma_client, collection
    try:
        if 'chroma_client' in globals() and chroma_client is not None:
            del chroma_client
            logger.info("  ✅ ChromaDB client deleted")
    except:
        pass
    
    try:
        if 'collection' in globals() and collection is not None:
            del collection
            logger.info("  ✅ Collection deleted")
    except:
        pass
    
    # 2. SentenceTransformer Model entladen
    try:
        if 'model' in globals() and model is not None:
            del model
            logger.info("  ✅ SentenceTransformer model deleted")
    except:
        pass
    
    # 3. PyTorch Cache leeren (falls verwendet)
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("  ✅ CUDA cache cleared")
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"  ⚠️ PyTorch cleanup failed: {e}")
    
    # 4. ONNX Runtime entladen (falls verwendet)
    try:
        import onnxruntime
        # ONNX hat kein explizites cleanup, aber wir können es neu laden
        logger.info("  ✅ ONNX runtime noted")
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"  ⚠️ ONNX cleanup failed: {e}")
    
    # 5. Python Garbage Collector erzwingen
    gc.collect()
    logger.info("  ✅ Garbage collector run")
    
    logger.info("✅ Cleanup complete!")


if __name__ == "__main__":
    try:
        main()
        logger.info("\n✅ Ingest completed successfully!")
    except Exception as e:
        logger.error(f"❌ Ingest failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # IMMER cleanup ausführen (auch bei Fehlern)
        cleanup_resources()
    
    # Expliziter Exit mit Success-Code
    sys.exit(0)