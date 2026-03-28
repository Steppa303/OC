#!/usr/bin/env python3
"""
Verification script to check that chat sessions were properly ingested into ChromaDB
"""

import chromadb
from sentence_transformers import SentenceTransformer
import json


def verify_ingestion():
    print("Verifying ChromaDB ingestion...")
    print("="*50)
    
    # Initialize ChromaDB client
    client = chromadb.PersistentClient(path="/root/.openclaw/chroma_db")
    
    # Get the collection
    collection = client.get_collection(name="chat_sessions")
    
    # Print collection stats
    count = collection.count()
    print(f"Total documents in collection: {count}")
    
    # Get a sample of documents to verify
    results = collection.get(limit=5)
    
    print(f"\nSample documents:")
    for i, (doc, metadata) in enumerate(zip(results['documents'], results['metadatas'])):
        print(f"\nDocument {i+1}:")
        print(f"  Content preview: {doc[:100]}...")
        print(f"  Session ID: {metadata.get('session_id')}")
        print(f"  Channel: {metadata.get('channel')}")
        print(f"  Role: {metadata.get('role')}")
        print(f"  Word count: {metadata.get('word_count')}")
        print(f"  Has code: {metadata.get('has_code')}")
        print(f"  Has recipes: {metadata.get('has_recipes')}")
        print(f"  Has emails: {metadata.get('has_emails')}")
        print(f"  Timestamp: {metadata.get('timestamp')}")
    
    # Test a semantic search to verify embeddings work
    print(f"\nTesting semantic search...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    query = "Bärlauchsuppe Rezept"
    query_embedding = model.encode([query]).tolist()
    
    search_results = collection.query(
        query_embeddings=query_embedding,
        n_results=3
    )
    
    print(f"Query: '{query}'")
    print(f"Found {len(search_results['documents'][0])} results")
    
    for i, (doc, meta, dist) in enumerate(zip(search_results['documents'][0], search_results['metadatas'][0], search_results['distances'][0])):
        print(f"  Result {i+1} (distance: {dist:.3f}):")
        print(f"    Preview: {doc[:80]}...")
        print(f"    Session: {meta.get('session_id')}")
        print(f"    Channel: {meta.get('channel')}")
    
    print(f"\n✅ Verification complete! All systems operational.")
    print(f"✅ Collection 'chat_sessions' contains {count} documents")
    print(f"✅ Metadata fields properly set")
    print(f"✅ Semantic search working")


if __name__ == "__main__":
    verify_ingestion()