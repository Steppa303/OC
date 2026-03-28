#!/usr/bin/env python3
"""
Verbessertes Skript zur Ingestion von Agent-Daten in ChromaDB
Unterstützt sowohl Dateiinput als auch stdin input
"""

import json
import chromadb
from sentence_transformers import SentenceTransformer
import sys
import argparse
from pathlib import Path


def ingest_agents_to_chromadb(agents_data):
    """Ingest agent data into ChromaDB collection 'agent_logs'"""
    print(f"Starting ingestion of {len(agents_data)} agents...")
    
    # Initialize ChromaDB client
    client = chromadb.PersistentClient(path="/root/.openclaw/chroma_db")
    
    # Get or create collection for agent logs
    collection = client.get_or_create_collection(
        name="agent_logs",
        metadata={"hnsw:space": "cosine"}
    )
    
    # Load embedding model
    print("Loading embedding model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Prepare agent data for ingestion
    documents = []
    metadatas = []
    ids = []
    
    for agent in agents_data:
        # Create a searchable document from agent data
        agent_text = f"Agent: {agent.get('label', 'Unknown')} - Task: {agent.get('task', 'No task')} - Status: {agent.get('status', 'unknown')} - Model: {agent.get('model', 'unknown')}"
        
        doc_id = f"agent_{agent['id']}"
        
        documents.append(agent_text)
        
        # Prepare metadata - ensure all values are strings, ints, or floats
        metadata = {
            'id': int(agent['id']),
            'session_key': str(agent['session_key']),
            'label': str(agent['label']),
            'task': str(agent['task']),
            'status': str(agent['status']),
            'model': str(agent['model']),
            'runtime_ms': agent['runtime_ms'] if agent['runtime_ms'] is not None else 0,
            'started_at': str(agent['started_at']),
            'ended_at': str(agent['ended_at']) if agent['ended_at'] is not None else '',
            'error_message': str(agent['error_message']) if agent['error_message'] is not None else '',
            'parent_session': str(agent['parent_session']) if agent['parent_session'] is not None else ''
        }
        metadatas.append(metadata)
        ids.append(doc_id)
    
    if documents:
        # Generate embeddings
        embeddings = model.encode(documents).tolist()
        
        # Add to collection
        collection.add(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        print(f"Successfully ingested {len(agents_data)} agents into ChromaDB!")
        print(f"Collection: agent_logs")
        print(f"Total documents in collection: {collection.count()}")
    else:
        print("No agents to ingest")
    
    return True


def main():
    parser = argparse.ArgumentParser(description='Ingest agent data into ChromaDB')
    parser.add_argument('-f', '--file', type=str, help='Path to JSON file containing agent data')
    parser.add_argument('-c', '--content', type=str, help='JSON content as string')
    
    args = parser.parse_args()
    
    agents_data = None
    
    if args.file:
        # Read from file
        with open(args.file, 'r', encoding='utf-8') as f:
            agents_data = json.load(f)
    elif args.content:
        # Read from command line argument
        agents_data = json.loads(args.content)
    else:
        # Read from stdin
        agents_json = sys.stdin.read()
        agents_data = json.loads(agents_json)
    
    success = ingest_agents_to_chromadb(agents_data)
    
    if success:
        print("✅ Agents successfully ingested!")
        sys.exit(0)
    else:
        print("❌ Failed to ingest agents")
        sys.exit(1)


if __name__ == "__main__":
    main()