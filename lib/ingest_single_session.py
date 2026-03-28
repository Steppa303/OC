#!/usr/bin/env python3
"""
Verbessertes Skript zur Ingestion einer einzelnen Chat-Session in ChromaDB
Mit besserem Error Handling, Logging und Robustheit
"""

import json
import os
import re
from datetime import datetime
import chromadb
from sentence_transformers import SentenceTransformer
import sys
import logging
from pathlib import Path


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
    except Exception as e:
        logger.warning(f"Could not extract channel from {filepath}: {e}")
        return 'unknown'


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
                    logger.error(f"Unexpected error processing line {line_num} in {filepath}: {e}")
                    continue
    
    except FileNotFoundError:
        logger.error(f"File not found: {filepath}")
        return []
    except PermissionError:
        logger.error(f"Permission denied accessing file: {filepath}")
        return []
    except Exception as e:
        logger.error(f"Error processing file {filepath}: {e}")
        return []
    
    logger.info(f"Found {len(interactions)} interactions in {filepath}")
    return interactions


def ingest_single_session_to_chromadb(session_filepath):
    """Ingest a single session file to ChromaDB"""
    logger.info(f"\nStarting ingestion of session: {session_filepath}")
    
    # Initialize ChromaDB client
    try:
        client = chromadb.PersistentClient(path="/root/.openclaw/chroma_db")
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB client: {e}")
        return False
    
    try:
        # Get or create collection for chat sessions
        collection = client.get_or_create_collection(
            name="chat_sessions",
            metadata={"hnsw:space": "cosine"}  # Using cosine similarity
        )
    except Exception as e:
        logger.error(f"Failed to get/create ChromaDB collection: {e}")
        return False
    
    # Load embedding model
    logger.info("Loading embedding model...")
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")
        return False
    
    # Process the session file
    interactions = process_jsonl_file(session_filepath)
    
    if not interactions:
        logger.info("No interactions found to ingest!")
        return False
    
    # Process in batches for efficiency
    batch_size = 100
    total_processed = 0
    
    try:
        for i in range(0, len(interactions), batch_size):
            batch = interactions[i:i + batch_size]
            
            logger.info(f"Ingesting batch {i//batch_size + 1}/{(len(interactions)-1)//batch_size + 1} ({len(batch)} items)")
            
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
            logger.info(f"  Completed batch - Total processed: {total_processed}/{len(interactions)}")
    except Exception as e:
        logger.error(f"Error during batch ingestion: {e}")
        return False
    
    logger.info(f"\nSuccessfully ingested {total_processed} interactions from {session_filepath} into ChromaDB!")
    logger.info(f"Collection: chat_sessions")
    logger.info(f"Total documents in collection: {collection.count()}")
    
    return True


def test_query(collection):
    """Test the ingestion with a sample query"""
    logger.info("\n" + "="*50)
    logger.info("TESTING QUERY")
    logger.info("="*50)
    
    query = "Dashboard Cleanup"
    
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        logger.info(f"Testing query: '{query}'")
        
        # Generate embedding for query
        query_embedding = model.encode([query]).tolist()
        
        # Perform similarity search
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=3,
            include=['documents', 'metadatas', 'distances']
        )
        
        logger.info(f"  Found {len(results['documents'][0])} results")
        
        for i, (doc, meta, dist) in enumerate(zip(results['documents'][0], results['metadatas'][0], results['distances'][0])):
            logger.info(f"    Result {i+1} (distance: {dist:.3f}):")
            logger.info(f"      Content preview: {doc[:100]}...")
            logger.info(f"      Session: {meta['session_id']}")
            logger.info(f"      Channel: {meta['channel']}")
            logger.info(f"      Timestamp: {meta['timestamp']}")
    except Exception as e:
        logger.error(f"Error during test query: {e}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        logger.error("Usage: python script.py <session_file_path>")
        sys.exit(1)
    
    session_file_path = sys.argv[1]
    
    # Validate file exists
    if not Path(session_file_path).exists():
        logger.error(f"Session file does not exist: {session_file_path}")
        sys.exit(1)
    
    success = ingest_single_session_to_chromadb(session_file_path)
    
    if success:
        logger.info(f"✅ Session {session_file_path} successfully ingested!")
        sys.exit(0)
    else:
        logger.error(f"❌ Failed to ingest session {session_file_path}")
        sys.exit(1)